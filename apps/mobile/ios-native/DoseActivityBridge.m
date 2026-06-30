// DoseActivityBridge.m — Spec 039 / F3. Expõe DoseActivityBridge (Swift) ao bridge RN.
// Injetado no target do APP por withDoseActivityBridge.js.

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(DoseActivityBridge, NSObject)

RCT_EXTERN_METHOD(start:(NSDictionary *)params
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(update:(NSDictionary *)params
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(done:(NSDictionary *)params
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(end:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(drainPendingActions:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
