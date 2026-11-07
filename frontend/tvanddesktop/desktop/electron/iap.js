// Mac App Store In-App Purchase bridge — verified by themegaradio.com backend.
//
// Flow (after backend hotfix dated 2026-05-07):
//   1. Renderer calls window.megaRadioNative.purchase(productId, token)
//   2. preload.js forwards { productId, token } to main via IPC
//   3. Main: inAppPurchase.purchaseProduct(productId) opens Apple sheet
//   4. transactions-updated event fires with state=purchased + receipt
//   5. Main reads the StoreKit receipt file (base64), POSTs it to
//      https://api.themegaradio.com/api/user/subscription with
//      platform: 'macos', productId, receipt, originalTransactionId
//   6. Backend calls Apple verifyReceipt; on 200 we forward
//      mr-iap-completed to renderer with the SERVER-VERIFIED plan + expiry
//      (the renderer will NOT trust StoreKit alone — must wait for backend OK)
//   7. On any error code (400/401/409/422/502) we forward mr-iap-failed
//      with the server's error code + message for the user-facing toast.

const { inAppPurchase } = require('electron');
const fs = require('fs');
const https = require('https');
const { createHash } = require('crypto');
const { fileURLToPath } = require('url');

const API_BASE = 'https://api.themegaradio.com';

let mainWindowRef = null;
let listenerAttached = false;
// Token snapshot from the most recent purchase/restore call so transaction
// callbacks can authenticate against the backend without round-tripping
// through the renderer.
let cachedToken = null;
let authGeneration = 0;
let purchaseBusy = false;
let pendingOperation = null;
const verifyingTransactions = new Set();
let purchaseTimer = null;
let restoreTimer = null;
function clearTimers() {
  clearTimeout(purchaseTimer); clearTimeout(restoreTimer);
  purchaseTimer = null; restoreTimer = null;
}
const PRODUCTS = new Set(['megaradio_premium_yearly', 'megaradio_premium_monthly1', 'megaradio_premium_lifetime', 'megaradio_remove_ads_yearly1']);
function setToken(token) {
  const next = typeof token === 'string' && token ? token : null;
  if (next !== cachedToken) { clearTimers(); cachedToken = next; authGeneration++; purchaseBusy = false; pendingOperation = null; }
}

function isMac() {
  return process.platform === 'darwin' && process.mas === true;
}

function readReceiptB64() {
  try {
    const url = inAppPurchase.getReceiptURL();
    const path = url ? (url.startsWith('file:') ? fileURLToPath(url) : url) : null;
    if (path && fs.existsSync(path)) {
      return fs.readFileSync(path).toString('base64');
    }
  } catch (e) {
    console.warn('[IAP] could not read receipt:', e?.message);
  }
  return null;
}

function postJson(pathname, body, token, method = 'POST') {
  return new Promise((resolve) => {
    const data = method === 'GET' ? '' : JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const req = https.request(
      {
        hostname: 'api.themegaradio.com',
        port: 443,
        path: pathname,
        method,
        headers,
        timeout: 20000,
      },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(buf); } catch (_) { json = { raw: buf }; }
          resolve({ status: res.statusCode, body: json });
        });
      }
    );
    req.on('error', (err) => resolve({ status: 0, body: { error: 'network', message: String(err?.message || err) } }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: { error: 'timeout' } }); });
    req.write(data);
    req.end();
  });
}

function send(channel, payload) {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send(channel, payload);
  }
}

async function verifyOnBackend({ productId, originalTransactionId, receiptB64, token }) {
  if (!token) {
    return { ok: false, code: 'no_auth', message: 'Premium’u kalıcı kılmak için lütfen giriş yapın.' };
  }
  if (!receiptB64) {
    return { ok: false, code: 'missing_receipt', message: 'Receipt okunamadı.' };
  }
  const { status, body } = await postJson('/api/user/subscription', {
    platform: 'macos',
    productId,
    receipt: receiptB64,
    originalTransactionId: originalTransactionId || undefined,
    autoRenewing: true,
  }, token);

  if (status === 200 && body && body.success === true && body.isActive === true && !body.error && ['remove_ads', 'premium_monthly', 'premium_yearly', 'premium_lifetime'].includes(body.plan)) {
    return { ok: true, server: body };
  }
  // Map backend error codes (per HOTFIX 2026-05-07 contract)
  // Apple verifyReceipt raw status codes (21002, 21003, 21007, ...) are also
  // surfaced by the backend in body.code — map the most common ones to
  // friendly Turkish messages.
  const code = body?.code || body?.error || `http_${status}`;
  const message =
    code === 'invalid_receipt' || code === '21002' || code === '21003' || code === '21010' ? 'Apple satın alma kaydını doğrulayamadı. Lütfen tekrar deneyin.' :
    code === '21007' ? 'Sandbox receipt production sunucusuna gönderildi. Geliştiriciye bildirin.' :
    code === '21008' ? 'Production receipt sandbox sunucusuna gönderildi.' :
    code === 'receipt_replay' ? 'Bu satın alma başka bir hesapta kullanılmış. Destek ekibiyle iletişime geçin.' :
    code === 'productId_mismatch' ? 'Ürün uyumsuz — App Store satışınızla seçtiğiniz plan eşleşmiyor.' :
    code === 'verify_unreachable' || code === '21005' ? 'Apple sunucusuna ulaşılamadı, lütfen birkaç saniye sonra tekrar deneyin.' :
    code === 'unknown_product' ? 'Bu ürün katalogda tanımlı değil.' :
    code === 'missing_receipt' ? 'Receipt eksik veya geçersiz.' :
    body?.error || body?.message || 'Doğrulama hatası.';
  return { ok: false, code, status, message, raw: body };
}

function attachTransactionListener() {
  if (listenerAttached || !isMac()) return;
  listenerAttached = true;

  inAppPurchase.on('transactions-updated', async (_event, transactions) => {
    if (!Array.isArray(transactions)) return;
    for (const tx of transactions) {
      const productId = tx.payment?.productIdentifier;
      const state = tx.transactionState;
      console.log('[IAP] tx', state, productId, tx.transactionIdentifier);

      if (state === 'purchased' || state === 'restored') {
        const operation = pendingOperation;
        // A delayed transaction from a previous login is retried only by an
        // explicit restore. Never attach it automatically to the current user.
        if (!operation || operation.generation !== authGeneration) continue;
        if (state === 'purchased' && (operation.kind !== 'purchase' || operation.productId !== productId || tx.payment?.applicationUsername !== operation.username)) continue;
        if (state === 'restored' && operation.kind !== 'restore') continue;
        const transactionKey = tx.transactionIdentifier;
        if (!transactionKey || verifyingTransactions.has(transactionKey)) continue;
        verifyingTransactions.add(transactionKey);
        const token = operation.token;
        const generation = authGeneration;
        if (!token || !PRODUCTS.has(productId)) { verifyingTransactions.delete(transactionKey); continue; }
        const receiptB64 = readReceiptB64();
        const verify = await verifyOnBackend({
          productId,
          originalTransactionId: tx.originalTransactionIdentifier,
          receiptB64,
          token,
        });
        verifyingTransactions.delete(transactionKey);
        if (generation !== authGeneration || token !== cachedToken || operation !== pendingOperation) continue;
        purchaseBusy = false;
        clearTimeout(purchaseTimer); purchaseTimer = null;
        if (operation.kind === 'purchase') pendingOperation = null;

        if (verify.ok) {
          operation.verified = true;
          send(state === 'restored' ? 'mr-iap-restored' : 'mr-iap-completed', {
            productId,
            transactionId: tx.transactionIdentifier,
            originalTransactionId: tx.originalTransactionIdentifier,
            server: verify.server, // { plan, expiryDate, isActive, features }
            state,
          });
          try { inAppPurchase.finishTransactionByDate(tx.transactionDate); } catch (_) {}
        } else {
          // Apple satışı tamamlandı ama backend doğrulayamadı.
          // Apple parayı çekmiş olabilir — kullanıcıya net bir hata göster.
          send('mr-iap-failed', {
            productId,
            transactionId: tx.transactionIdentifier,
            code: verify.code,
            status: verify.status,
            message: verify.message,
            stage: 'backend_verify',
          });
        }
      } else if (state === 'failed') {
        if (pendingOperation?.kind !== 'purchase' || pendingOperation.productId !== productId || tx.payment?.applicationUsername !== pendingOperation.username) continue;
        pendingOperation = null;
        purchaseBusy = false;
        clearTimeout(purchaseTimer); purchaseTimer = null;
        send('mr-iap-failed', {
          productId,
          error: tx.errorMessage || 'Purchase failed',
          errorCode: tx.errorCode,
          stage: 'storekit',
        });
        try { inAppPurchase.finishTransactionByDate(tx.transactionDate); } catch (_) {}
      }
    }
  });
}

function registerIpc(ipcMain, getMainWindow) {
  ipcMain.handle('mr-iap-set-auth', (_e, token) => { setToken(token); mainWindowRef = getMainWindow(); return { ok: true }; });
  mainWindowRef = getMainWindow();
  attachTransactionListener();
  ipcMain.handle('mr-iap-purchase', async (_e, payload) => {
    // The Mac app has no paid-only features. Keep restore/verification for
    // existing accounts, but do not sell unsupported capabilities.
    if (isMac()) return { ok: false, reason: 'no-new-purchases', message: 'Listening is included in this Mac app. New purchases are not offered.' };

    if (!isMac()) {
      return { ok: false, reason: 'not-mac', message: 'StoreKit only available on macOS App Store builds.' };
    }
    if (!inAppPurchase.canMakePayments()) {
      return { ok: false, reason: 'cannot-pay', message: 'In-App Purchases are disabled on this device.' };
    }
    const { productId, token } = (typeof payload === 'string') ? { productId: payload } : (payload || {});
    if (!PRODUCTS.has(productId)) return { ok: false, reason: 'no-product', message: 'Unknown product' };
    if (!token || token !== cachedToken) return { ok: false, reason: 'no-auth', message: 'Sign in again before purchasing.' };
    if (purchaseBusy || pendingOperation) return { ok: false, reason: 'busy', message: 'A purchase is already in progress.' };
    purchaseBusy = true;
    const generation = authGeneration;
    const username = createHash('sha256').update(token).digest('hex');
    const operation = { kind: 'purchase', token, generation, productId, username };
    pendingOperation = operation;
    purchaseTimer = setTimeout(() => {
      if (generation !== authGeneration) return;
      purchaseBusy = false; purchaseTimer = null; pendingOperation = null;
      send('mr-iap-failed', { code: 'TIMEOUT', message: 'No verified purchase result received. Please try Restore Purchases.' });
    }, 120000);
    mainWindowRef = getMainWindow();
    attachTransactionListener();
    try {
      const session = await postJson('/api/auth/tv/verify', null, token, 'GET');
      if (pendingOperation !== operation || token !== cachedToken || generation !== authGeneration) return { ok: false, reason: 'session', message: 'Account changed. Please retry.' };
      if (session.status !== 200 || session.body?.valid !== true) {
        purchaseBusy = false; pendingOperation = null; clearTimeout(purchaseTimer); purchaseTimer = null;
        return { ok: false, reason: 'session', message: 'Your session could not be verified. Please sign in again.' };
      }
      const ok = await inAppPurchase.purchaseProduct(productId, { quantity: 1, username });
      if (!ok && pendingOperation === operation) { purchaseBusy = false; pendingOperation = null; clearTimeout(purchaseTimer); purchaseTimer = null; }
      return { ok, productId };
    } catch (err) {
      if (pendingOperation === operation) {
        purchaseBusy = false; pendingOperation = null;
        clearTimeout(purchaseTimer); purchaseTimer = null;
      }
      return { ok: false, reason: 'exception', message: String(err?.message || err) };
    }
  });

  ipcMain.handle('mr-iap-restore', async (_e, payload) => {
    if (!isMac()) return { ok: false, reason: 'not-mac' };
    const token = payload && payload.token;
    if (!token || token !== cachedToken) return { ok: false, reason: 'no-auth', message: 'Sign in before restoring purchases.' };
    if (restoreTimer || pendingOperation) return { ok: false, reason: 'busy', message: 'Restore already in progress.' };
    mainWindowRef = getMainWindow();
    attachTransactionListener();
    try {
      // Actual restored transaction supplies its productIdentifier. Never label
      // monthly/lifetime receipts as yearly. Entitlements arrive via verified event.
      const generation = authGeneration;
      const operation = { kind: 'restore', token, generation, verified: false };
      pendingOperation = operation;
      restoreTimer = setTimeout(() => {
        restoreTimer = null;
        if (pendingOperation === operation) pendingOperation = null;
        if (generation === authGeneration && !operation.verified) send('mr-iap-failed', { code: 'RESTORE_TIMEOUT', message: 'No verified purchase was received. Check the store account and retry.' });
      }, 20000);
      inAppPurchase.restoreCompletedTransactions();
      return { ok: true, pending: true };
    } catch (err) {
      clearTimeout(restoreTimer); restoreTimer = null; pendingOperation = null;
      return { ok: false, reason: 'exception', message: String(err?.message || err) };
    }
  });

  ipcMain.handle('mr-iap-cancel', async (_e, payload) => {
    // Mac App Store / Play Store subscriptions cannot be cancelled by the
    // backend (Apple/Google manage billing). The server now returns 409
    // manage_in_store with a manageUrl — we just open it in the system browser.
    const { shell } = require('electron');
    const token = payload && payload.token;
    if (!token || token !== cachedToken) return { ok: false, reason: 'no-auth' };
    const { status, body } = await postJson('/api/user/subscription/cancel', {}, token);
    if (status === 409 && body?.code === 'manage_in_store' && body?.manageUrl) {
      shell.openExternal(body.manageUrl);
      return { ok: true, opened: body.manageUrl, message: body.error };
    }
    return { ok: status === 200, status, body };
  });

  ipcMain.handle('mr-iap-get-products', async (_e, ids) => {
    if (!isMac()) return [];
    try {
      const products = await inAppPurchase.getProducts(Array.isArray(ids) ? ids : []);
      return products;
    } catch (err) {
      console.warn('[IAP] getProducts failed:', err?.message);
      return [];
    }
  });
}

module.exports = { registerIpc };
