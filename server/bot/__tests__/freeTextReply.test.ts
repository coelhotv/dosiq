// freeTextReply.test.ts — spec 096 B0 T044 (PO-12, parte bot)
//
// Texto livre no Telegram não vai mais à Groq: o bot responde a copy fixa S13
// (DESIGN_DECISOES.md §4) e nenhum código do bot alcança o SDK do LLM.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleFreeTextMessage, FREE_TEXT_REPLY } from '../commands/chatbot.js';

const BOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

function makeBot(sendImpl?: () => Promise<unknown>) {
  return { sendMessage: vi.fn(sendImpl ?? (async () => ({}))) };
}

function listSources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : listSources(full);
    return /\.(ts|js)$/.test(name) ? [full] : [];
  });
}

describe('handleFreeTextMessage (S13)', () => {
  afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers(); vi.unstubAllGlobals(); });

  it('responde a copy S13 em MarkdownV2, sem rede', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const bot = makeBot();

    await handleFreeTextMessage(bot, { chat: { id: 42 }, text: 'quanto tomo hoje de losartana?' });

    expect(bot.sendMessage).toHaveBeenCalledTimes(1);
    expect(bot.sendMessage).toHaveBeenCalledWith(42, FREE_TEXT_REPLY, { parse_mode: 'MarkdownV2' });
    expect(FREE_TEXT_REPLY).toBe(
      'O assistente agora fica só no app\\. Abra o dosiq e toque no botão de conversa\\.'
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['sem texto (foto/sticker)', undefined],
    ['texto vazio', '   '],
    ['comando', '/hoje'],
  ])('%s ⇒ silêncio', async (_label, text) => {
    const bot = makeBot();
    await handleFreeTextMessage(bot, { chat: { id: 42 }, text });
    expect(bot.sendMessage).not.toHaveBeenCalled();
  });

  it('falha de envio não propaga (webhook segue 200)', async () => {
    const bot = makeBot(async () => { throw new Error('telegram 429'); });
    await expect(handleFreeTextMessage(bot, { chat: { id: 42 }, text: 'oi' })).resolves.toBeUndefined();
  });

  it('nenhum arquivo do bot importa o SDK da Groq', () => {
    const offenders = listSources(BOT_DIR).filter((f) => /groq-sdk|chatbotServerService/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
