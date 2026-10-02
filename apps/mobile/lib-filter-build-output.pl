#!/usr/bin/perl
# lib-filter-build-output.pl — filtro de terminal para a saída do `eas build` / `eas update`.
#
# Uso:  <comando> 2>&1 | tee <log> | perl lib-filter-build-output.pl <phases|all> [regex-extra]
#
# O LOG recebe tudo (o tee vem antes deste filtro); aqui só se decide o que aparece no TERMINAL.
#
# POR QUE EXISTE: o `eas build --local` despeja milhares de linhas (iOS production medido em
# 2026-10-02: 2273 linhas — 1343 do xcodebuild, 383 `Copying ...` quase idênticas, 321 de pods) e,
# sem terminal na saída, spinners/barras de progresso viram uma linha nova a cada atualização.
#
#   phases  (builds) uma linha por FASE (prefixo `[RUN_FASTLANE]`, `[INSTALL_PODS]`...) com o tempo
#           decorrido, mais erros/avisos e o que casar com [regex-extra].
#   all     (OTA) tudo, exceto spinner e barra de progresso — a saída do `eas update` é curta.
#
# Nunca esconde falha: erro/aviso passam nos dois modos, e o chamador mostra o fim do log se o
# build falhar. Para ver tudo: DOSIQ_BUILD_VERBOSE=1.
use strict;
use warnings;
use utf8;

binmode(STDIN,  ':utf8');
binmode(STDOUT, ':utf8');
$| = 1;

my ($mode, $extra) = @ARGV;
$mode ||= 'phases';
my $extra_re = (defined $extra && length $extra) ? qr/$extra/ : undef;

# `error`/`failed` só como palavra isolada: "React-jserrorhandler" e "ErrorUtils.m" não casam.
my $always = qr/(?:^|[^A-Za-z])(?:error|Error|ERROR|FAILED|failed|fatal)\b|❌|⚠|warning:|Build successful|Archive Succeeded|BUILD (?:SUCCESSFUL|FAILED)/;

my $t0   = time;
my $last = '';

while (my $raw = <STDIN>) {
    $raw =~ s/\e\[[0-9;?]*[A-Za-z]//g;                 # códigos ANSI
    # Quadros de spinner: do caractere braille até o próximo braille ou marcador de resultado
    # (✔ ✖ ℹ). "⠼ Uploading (0/34)⠧ Uploading (34/34)✔ Uploaded" vira "✔ Uploaded".
    $raw =~ s/[\x{2800}-\x{28FF}][^\x{2800}-\x{28FF}✔✖ℹ]*//g;

    for my $seg (split /\r/, $raw) {                   # \r = redesenho de barra de progresso
        $seg =~ s/\s+$//;
        next if $seg eq '';
        next if $seg =~ /index\.ts\s+[▓▒░█]/;          # barra do Metro
        # Inventário de assets/bundles do `expo export`: ruído (o log guarda tudo).
        next if $seg =~ m{^\[expo-cli\](?:\s*$|\s+(?:\.\./|assets/|_expo/|assetmap|metadata|›\s+(?:Assets|android bundles|ios bundles|Files)))};

        if ($mode eq 'all') {
            print "   $seg\n";
            next;
        }

        if ($seg =~ /^\[([A-Z][A-Z_]+)\]/ && $1 ne $last) {
            $last = $1;
            my $s = time - $t0;
            printf "   ▸ [%02d:%02d] %s\n", int($s / 60), $s % 60, $last;
        }
        if ($seg =~ $always || ($extra_re && $seg =~ $extra_re)) {
            print '       ' . substr($seg, 0, 220) . "\n";
        }
    }
}
