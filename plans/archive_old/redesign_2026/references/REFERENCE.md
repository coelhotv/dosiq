# Documento de Referência: Dosiq

Este documento serve como guia para o desenvolvedor que irá implementar as funcionalidades do aplicativo "Dosiq".

## 1. Visão Geral
O aplicativo é uma ferramenta de adesão medicamentosa **100% gratuita**, focada em privacidade (Privacy-First) e portabilidade clínica.

## 2. Features em Produção (MVP)

### Gestão e Inteligência
- **Base ANVISA**: Autocomplete integrado com mais de 10.000 medicamentos registrados.
- **Protocolos Flexíveis**: Suporte a frequências diárias, semanais, personalizadas e "se necessário".
- **Titulação de Doses**: Timeline visual para automação de transições e histórico de fases de tratamento.
- **Inteligência Local**: Previsão de estoque e score de risco calculados inteiramente no browser (localStorage).

### Alertas e Notificações
- **Multicanal**: Push notifications via PWA e integração com Bot exclusivo no Telegram.
- **Controle de Estoque**: Alertas de reposição baseados no uso real (decremento automático).

### Portabilidade e Segurança
- **PDF de Consulta**: Relatório profissional com histórico de adesão para médicos.
- **Cartão de Emergência**: Acesso offline aos medicamentos ativos para urgências.
- **Exportação**: Dados disponíveis em CSV e JSON para portabilidade total.
- **Privacy-First**: Analytics privado e armazenamento local (sem telemetria externa).

## 3. Requisitos por Persona

### Dona Maria (Simplicidade)
- Interface de alta legibilidade.
- Lembretes via Telegram (canal familiar).
- Fotos dos medicamentos (Base ANVISA).

### Carlos (Eficiência)
- Score de adesão e Streaks (Gamificação).
- Relatórios em PDF para envio rápido.
- Instalação PWA para acesso rápido.

## 4. Stack Tecnológica
- **Frontend**: React + Tailwind CSS + Framer Motion.
- **Backend**: Node.js (Express) para Bot Telegram e PWA.
- **Armazenamento**: LocalStorage / IndexedDB (Primário) + Firestore (Opcional para Sync).
