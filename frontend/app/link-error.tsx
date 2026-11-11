import React from 'react';
import { SharedLinkState } from '../src/components/SharedLinkState';
export default function LinkError() {
  return <SharedLinkState testID="invalid-shared-link" message="Bağlantı eksik veya geçersiz. Gönderen kişiden yeniden paylaşmasını isteyebilirsin." />;
}
