import { Text, StyleSheet } from 'react-native';

/**
 * Parses a subset of Telegram MarkdownV2 into React Native Text elements.
 * Only handles patterns actually used in Dosiq notification bodies.
 */
export function parseTelegramMarkdownNative(text) {
  if (!text) return null;

  // Step 1: Unescape Telegram escape sequences → literal characters
  const unescaped = text
    .replace(/\\([.!()[\]{}_*~`>#+=|{}.!-])/g, '$1');

  // Step 2: Split on newlines, then parse inline formatting per line
  const lines = unescaped.split('\n');

  return lines.map((line, lineIndex) => {
    const parts = [];
    let remaining = line;
    let key = 0;

    while (remaining.length > 0) {
      // Prioritize double markers (**bold**, __italic__)
      const boldMatch = remaining.match(/^\*\*([\s\S]+?)\*\*/) || remaining.match(/^\*([\s\S]+?)\*/);
      const italicMatch = remaining.match(/^__([\s\S]+?)__/) || remaining.match(/^_([\s\S]+?)_/);

      if (boldMatch) {
        parts.push(<Text key={key++} style={styles.bold}>{boldMatch[1]}</Text>);
        remaining = remaining.slice(boldMatch[0].length);
      } else if (italicMatch) {
        parts.push(<Text key={key++} style={styles.italic}>{italicMatch[1]}</Text>);
        remaining = remaining.slice(italicMatch[0].length);
      } else {
        const nextSpecial = remaining.search(/[*_]/);
        if (nextSpecial === -1) {
          parts.push(<Text key={key++}>{remaining}</Text>);
          remaining = '';
        } else if (nextSpecial === 0) {
          // Force advance if we are at a special char but no match was found
          parts.push(<Text key={key++}>{remaining[0]}</Text>);
          remaining = remaining.slice(1);
        } else {
          parts.push(<Text key={key++}>{remaining.slice(0, nextSpecial)}</Text>);
          remaining = remaining.slice(nextSpecial);
        }
      }
    }

    return (
      <Text key={lineIndex}>{parts}{lineIndex < lines.length - 1 ? '\n' : ''}</Text>
    );
  });
}

const styles = StyleSheet.create({
  bold: {
    fontWeight: 'bold',
  },
  italic: {
    fontStyle: 'italic',
  },
});
