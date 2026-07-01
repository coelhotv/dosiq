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

// Spec 041: token push-to-start do ActivityKit (iOS 17.2+). Inicia o observer (idempotente) e
// retorna o token hex persistido no App Group (ou "" se ainda não emitido / iOS < 17.2).
RCT_EXTERN_METHOD(getPushToStartToken:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
