// DoseActivityBridge.m — Spec 039 / F0 spike iOS
// Expõe DoseActivityBridge (Swift) ao bridge RN. Adicione ao target do APP.

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(DoseActivityBridge, NSObject)

RCT_EXTERN_METHOD(start:(NSDictionary *)params
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(end:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
