#import <React/RCTBridgeModule.h>
#import <AppTrackingTransparency/AppTrackingTransparency.h>
#import <UIKit/UIKit.h>

// Keep this module in the Expo plugin so prebuild cannot remove the ATT bridge.
@interface ATTModule : NSObject <RCTBridgeModule>
@property(nonatomic, strong) NSMutableArray *pending;
@property(nonatomic, strong) id activeObserver;
@property(nonatomic, assign) BOOL requesting;
@end

@implementation ATTModule
RCT_EXPORT_MODULE();
+ (BOOL)requiresMainQueueSetup { return YES; }
- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }

- (NSString *)statusName:(ATTrackingManagerAuthorizationStatus)status {
  switch (status) {
    case ATTrackingManagerAuthorizationStatusAuthorized: return @"authorized";
    case ATTrackingManagerAuthorizationStatusDenied: return @"denied";
    case ATTrackingManagerAuthorizationStatusRestricted: return @"restricted";
    default: return @"notDetermined";
  }
}

- (void)finish:(NSString *)status {
  NSArray *callbacks = [self.pending copy];
  [self.pending removeAllObjects];
  self.requesting = NO;
  if (self.activeObserver) {
    [[NSNotificationCenter defaultCenter] removeObserver:self.activeObserver];
    self.activeObserver = nil;
  }
  for (RCTPromiseResolveBlock resolve in callbacks) resolve(status);
}

- (void)requestWhenActive {
  if (self.requesting || !self.pending.count) return;
  if (UIApplication.sharedApplication.applicationState != UIApplicationStateActive) return;
  ATTrackingManagerAuthorizationStatus status = ATTrackingManager.trackingAuthorizationStatus;
  if (status != ATTrackingManagerAuthorizationStatusNotDetermined) {
    [self finish:[self statusName:status]];
    return;
  }
  self.requesting = YES;
  [ATTrackingManager requestTrackingAuthorizationWithCompletionHandler:^(ATTrackingManagerAuthorizationStatus result) {
    dispatch_async(dispatch_get_main_queue(), ^{ [self finish:[self statusName:result]]; });
  }];
}

RCT_REMAP_METHOD(requestPermission,
                 requestPermissionWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
  if (![NSBundle.mainBundle objectForInfoDictionaryKey:@"NSUserTrackingUsageDescription"]) {
    reject(@"E_ATT_CONFIGURATION", @"Tracking usage description is missing", nil);
    return;
  }
  if (!self.pending) self.pending = [NSMutableArray array];
  [self.pending addObject:[resolve copy]];
  if (!self.activeObserver) {
    __weak ATTModule *weakSelf = self;
    self.activeObserver = [[NSNotificationCenter defaultCenter]
      addObserverForName:UIApplicationDidBecomeActiveNotification object:nil
      queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification *note) {
        // Avoid competing with another system permission alert being dismissed.
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 500 * NSEC_PER_MSEC), dispatch_get_main_queue(), ^{
          [weakSelf requestWhenActive];
        });
      }];
  }
  [self requestWhenActive];
}

- (void)dealloc {
  if (self.activeObserver) [[NSNotificationCenter defaultCenter] removeObserver:self.activeObserver];
}
@end
