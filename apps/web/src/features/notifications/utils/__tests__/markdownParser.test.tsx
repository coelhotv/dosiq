import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { parseTelegramMarkdown } from '../markdownParser';

describe('parseTelegramMarkdown', () => {
  it('should render bold text', () => {
    const { container } = render(<div>{parseTelegramMarkdown('*bold*')}</div>);
    expect(container.querySelector('strong')).toBeDefined();
    expect(container.querySelector('strong').textContent).toBe('bold');
  });

  it('should render italic text', () => {
    const { container } = render(<div>{parseTelegramMarkdown('_italic_')}</div>);
    expect(container.querySelector('em')).toBeDefined();
    expect(container.querySelector('em').textContent).toBe('italic');
  });

  it('should unescape special characters', () => {
    const { container } = render(<div>{parseTelegramMarkdown('Hello\\!')}</div>);
    expect(container.textContent).toBe('Hello!');
  });

  it('should handle sample 1 (dose_reminder_by_plan)', () => {
    const sample = '🍽️ *Quarteto Fantástico*\n\n2 medicamentos agora — 12:15\n\n  💊 SeloZok 50mg — 1 cp\n  💊 Forxiga 10mg — 1 cp';
    const { container } = render(<div>{parseTelegramMarkdown(sample)}</div>);
    
    // Check for bold title
    expect(container.querySelector('strong').textContent).toBe('Quarteto Fantástico');
    
    // Check for emojis and text
    expect(container.textContent).toContain('🍽️');
    expect(container.textContent).toContain('2 medicamentos agora');
    expect(container.textContent).toContain('💊 SeloZok 50mg');
  });

  it('should handle sample 2 (daily_digest)', () => {
    const sample = 'Bom dia, *João*\\!\n\nVocê tem *2* doses pendentes para hoje:\n\n💊 *Atorvastatina*\n⏰ 08:00 \\(1 cp\\)\n\nNão se esqueça de registrar no app\\!';
    const { container } = render(<div>{parseTelegramMarkdown(sample)}</div>);
    
    // Check for bold names
    const bolds = Array.from(container.querySelectorAll('strong')).map(el => el.textContent);
    expect(bolds).toContain('João');
    expect(bolds).toContain('2');
    expect(bolds).toContain('Atorvastatina');
    
    // Check for unescaped characters
    expect(container.textContent).toContain('João!');
    expect(container.textContent).toContain('(1 cp)');
    expect(container.textContent).toContain('app!');
  });
  
  it('should handle double markers (**bold**, __italic__)', () => {
    const { container } = render(
      <div>{parseTelegramMarkdown('**double bold** and __double italic__')}</div>
    );
    expect(container.querySelector('strong').textContent).toBe('double bold');
    expect(container.querySelector('em').textContent).toBe('double italic');
  });

  it('should handle mixed markers correctly', () => {
    const { container } = render(
      <div>{parseTelegramMarkdown('**bold** with *single* and _italic_ with __double__')}</div>
    );
    const bolds = Array.from(container.querySelectorAll('strong')).map(el => el.textContent);
    const italics = Array.from(container.querySelectorAll('em')).map(el => el.textContent);
    
    expect(bolds).toContain('bold');
    expect(bolds).toContain('single');
    expect(italics).toContain('italic');
    expect(italics).toContain('double');
  });

  it('should not crash on mismatched markers', () => {
    const { container } = render(
      <div>{parseTelegramMarkdown('**mismatched* marker')}</div>
    );
    // Should render as "<strong>*mismatched</strong>" + " marker"
    expect(container.textContent).toBe('*mismatched marker');
    expect(container.querySelector('strong').textContent).toBe('*mismatched');
  });
});
