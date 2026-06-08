// DESATIVADO (022 Fase C): o registro de dose por chat usava matemática de dose
// pré-022 (mg = comprimidos × concentração) incompatível com líquidos (gotas/ml/UI)
// e com a conversão da RPC consume_stock_fifo — gerava double-conversion e textos
// "comprimidos" errados. Como o registro confiável vive no app (web/mobile) e nos
// botões dos lembretes, /registrar foi desativado p/ reduzir superfície de risco.
// Reativar exige reescrever a dose-math p/ dosage_per_intake na unidade de tomada.

export async function handleRegistrar(bot, msg) {
  const chatId = msg.chat && msg.chat.id;
  if (!chatId) return;

  await bot.sendMessage(
    chatId,
    '💊 O registro de dose pelo chat foi desativado.\n\n' +
      'Registre suas doses pelo app (Dosiq web/mobile) ou pelo botão "Tomei" nos lembretes — ' +
      'lá o cálculo de dose e estoque é preciso para todos os formatos (comprimidos, líquidos, insulina).'
  );
}