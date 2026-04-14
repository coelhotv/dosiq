# Guia Pratico - App Access para Google Play Console

> **Contexto:** Meus Remedios hybrid/native | Android review
> **Data:** 2026-04-14
> **Objetivo:** deixar pronto o material que a Google Play pode pedir para autenticação e revisão do app

---

## 1. Quando este guia é necessário

Use este guia quando a Google Play Console pedir instruções de acesso ao app porque:

- o app exige login
- parte relevante do conteúdo fica atrás de autenticação
- o revisor precisa conseguir navegar sem bloqueios

Para o Meus Remédios, este material deve ser tratado como obrigatório.

---

## 2. O que a Google Play precisa receber

Você deve estar pronto para informar:

- e-mail de teste
- senha de teste
- passos curtos para login
- o que o revisor encontrará depois do login
- qualquer observação relevante, se existir

---

## 3. Conta de review recomendada

Crie uma conta exclusiva para revisão, separada da sua conta pessoal.

### Recomendação

- use um e-mail dedicado, por exemplo: `review@coelho.me`
- use senha estável
- não altere a senha durante o período de revisão
- não reutilize sua conta pessoal

### Por que isso importa

Se a conta estiver quebrada, vazia ou mudando de estado durante a análise, a revisão pode travar ou gerar rejeição por falta de acesso.

---

## 4. Checklist da conta de teste

A conta de review deve estar preparada com dados mínimos reais de navegação.

### Obrigatório

- login funcionando
- sessão entrando normalmente
- tela `Hoje` com conteúdo útil
- pelo menos 1 tratamento ativo
- pelo menos 1 item em estoque
- tela `Perfil` acessível

### Recomendado

- ao menos 1 dose já registrada
- dados suficientes para o revisor entender o propósito do app sem precisar cadastrar tudo do zero
- conteúdo estável, sem depender de dados temporários frágeis

### Evite

- conta vazia
- conta quebrada por onboarding incompleto
- conta com dados sensíveis reais seus
- conta que depende de configuração manual longa para funcionar

---

## 5. Texto pronto em português

Use este texto como base para os campos internos da sua documentação ou quando precisar registrar a instrução em português:

```text
O app exige autenticação para acesso às funcionalidades principais.

Credenciais de teste:
E-mail: REVIEW_EMAIL
Senha: REVIEW_PASSWORD

Passos para acesso:
1. Abra o app.
2. Toque em "Entrar".
3. Faça login com as credenciais informadas acima.
4. Após o login, o app abrirá a área principal com o resumo do dia.
5. Navegue pelas seções Hoje, Tratamentos, Estoque e Perfil.

Observações:
- A conta de teste já possui dados de exemplo para permitir a navegação durante a revisão.
- Não é necessário convite, código promocional ou aprovação manual adicional.
```

---

## 6. Texto pronto em inglês

Este é o texto mais útil para colar na Google Play Console, porque a revisão pode ocorrer em inglês.

```text
This app requires authentication to access its main features.

Test credentials:
Email: REVIEW_EMAIL
Password: REVIEW_PASSWORD

Steps to access the app:
1. Open the app.
2. Tap "Entrar" on the login screen.
3. Sign in using the test credentials above.
4. After login, the app will open the main area with the daily summary.
5. Review the main sections: Hoje, Tratamentos, Estoque, and Perfil.

Notes:
- The test account already contains sample data for review purposes.
- No invitation code, payment, or additional approval is required.
```

---

## 7. Versão adaptada para colar diretamente na Play Console

Substitua apenas `REVIEW_EMAIL` e `REVIEW_PASSWORD`.

```text
This app requires login to access its core functionality.

Review account:
Email: REVIEW_EMAIL
Password: REVIEW_PASSWORD

Review steps:
1. Open the app.
2. Tap "Entrar".
3. Log in with the credentials above.
4. After login, the app opens the main dashboard with the daily medication summary.
5. You can review the following sections: Hoje, Tratamentos, Estoque, and Perfil.

The review account already contains sample data. No invitation code or special approval is required.
```

---

## 8. Como preencher para o Meus Remédios

### Estrutura recomendada

- idioma do texto enviado: inglês
- labels internas do app podem continuar em pt-BR
- passos devem ser curtos
- evitar explicações longas

### O que o revisor deve conseguir validar

- que o login funciona
- que o app não está vazio
- que existe proposta de valor real após autenticação
- que o fluxo principal pode ser navegado sem ajuda manual

---

## 9. Script operacional antes de enviar para review

Antes de apertar submit na Play Console:

1. entrar na conta de review em um aparelho limpo
2. validar se login funciona
3. validar se a senha ainda é a mesma
4. validar se a conta ainda tem dados de exemplo
5. validar se `Hoje`, `Tratamentos`, `Estoque` e `Perfil` carregam
6. copiar o texto final no campo de App Access

---

## 10. Modelo final recomendado

Se você quiser uma versão curta, eu recomendo usar esta:

```text
This app requires login to access its main features.

Test account:
Email: REVIEW_EMAIL
Password: REVIEW_PASSWORD

Steps:
1. Open the app.
2. Tap "Entrar".
3. Log in using the credentials above.
4. After login, review the main sections: Hoje, Tratamentos, Estoque, and Perfil.

The test account already includes sample data. No invitation code or additional approval is required.
```
