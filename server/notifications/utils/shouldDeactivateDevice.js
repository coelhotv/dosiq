// Determina se um token deve ser desativado com base no código de erro do Expo
// Erros permanentes indicam que o device não pode mais receber notificações

const PERMANENT_ERRORS = ['DeviceNotRegistered', 'InvalidCredentials', 'MessageTooBig']

export function shouldDeactivateDevice(errorCode) {
  return PERMANENT_ERRORS.includes(errorCode)
}
