/**
 * Parses a subset of Telegram MarkdownV2 into React elements.
 * Only handles patterns actually used in Dosiq notification bodies.
 */
export function parseTelegramMarkdown(text) {
  if (!text) return null;

  // Step 1: Unescape Telegram escape sequences → literal characters
  const unescaped = text
    .replace(/\\([.!()[\]{}_*~`>#+=|{}.!-])/g, '$1');

  // Step 2: Split on newlines, then parse inline formatting per line
  const lines = unescaped.split('\n');

  return lines.map((line, lineIndex) => {
    // Parse *bold* and _italic_ inline
    const parts = [];
    let remaining = line;
    let key = 0;

    while (remaining.length > 0) {
      // Prioritize double markers (**bold**, __italic__)
      const boldMatch = remaining.match(/^\*\*([\s\S]+?)\*\*/) || remaining.match(/^\*([\s\S]+?)\*/);
      const italicMatch = remaining.match(/^__([\s\S]+?)__/) || remaining.match(/^_([\s\S]+?)_/);

      if (boldMatch) {
        parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
        remaining = remaining.slice(boldMatch[0].length);
      } else if (italicMatch) {
        parts.push(<em key={key++}>{italicMatch[1]}</em>);
        remaining = remaining.slice(italicMatch[0].length);
      } else {
        // Consume up to the next * or _
        const nextSpecial = remaining.search(/[*_]/);
        if (nextSpecial === -1) {
          parts.push(<span key={key++}>{remaining}</span>);
          remaining = '';
        } else if (nextSpecial === 0) {
          // Fallback for unclosed tags or special chars: consume 1 char to avoid infinite loop
          parts.push(<span key={key++}>{remaining[0]}</span>);
          remaining = remaining.slice(1);
        } else {
          parts.push(<span key={key++}>{remaining.slice(0, nextSpecial)}</span>);
          remaining = remaining.slice(nextSpecial);
        }
      }
    }

    return (
      <span key={lineIndex} className="markdown-line">
        {parts.length > 0 ? parts : ' '}
      </span>
    );
  });
}
