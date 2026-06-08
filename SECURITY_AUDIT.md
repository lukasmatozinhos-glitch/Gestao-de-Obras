# RELATÓRIO DE AUDITORIA TÉCNICA E SEGURANÇA DA INFORMAÇÃO
**CLIENTE:** AXIA ENERGIA  
**PROJETO:** SGP - Sistema de Gestão de Projetos (React + Firebase + Capacitor)  
**DATA:** 3 de Junho de 2026  
**STATUS:** CONCLUÍDO (Pronto para Implementação)

---

## 1. INTRODUÇÃO E MODELO DE AMEAÇAS

Este documento apresenta uma análise detalhada da arquitetura de segurança da informação atual do Sistema de Gestão de Projetos da **AXIA ENERGIA**. A auditoria inicial concentrou-se na conformidade com o princípio do menor privilégio, integridade das transações do Firestore, validação rigorosa de payloads nas regras de segurança, restrições criptográficas para PII e preparação de infraestrutura para governança e auditoria imutável integrada.

---

## 2. INVENTÁRIO DE VULNERABILIDADES Mapeadas (Tabela de Risco)

| ID | Vulnerabilidade | Impacto Estimado | Criticidade | Arquivo(s) Afetado(s) | Proposta de Mitigação |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **Querying Laxista e Ausência de Segregação de Dados** | Permite que fiscais de campo ou usuários comuns consultem e recebam em tempo real registros de todas as obras da plataforma que não são suas. | **Crítica** | `/src/App.tsx`<br>`/firestore.rules` | Alterar consultas `onSnapshot` no cliente para injetar cláusula `where('projectId', '==', ...)` e forçar as regras do Firestore a validar as consultas de leitura (`allow list`). |
| **SEC-02** | **Atualizações de Dados Parciais Desprotegidas ("Update-Gaps")** | Permite burlar a validação adicionando campos arbitrários em documentos existentes por não usar verificação estrita pelo `affectedKeys().hasOnly()`. | **Alta** | `/firestore.rules` | Segmentar atualizações por ações específicas utilizando `diff()` e regular a escrita de atributos sensíveis via `hasOnly()`. |
| **SEC-03** | **Validação Falha de Uploads de Extensões** | No backend/Storage, uploads de scripts maliciosos (`.js`, `.bat`, `.exe`) não estavam bloqueados, permitindo injeções de arquivos indesejados. | **Alta** | `/src/App.tsx`<br>`/storage.rules` | Adicionar método `validateUploadedFile` no frontend e reescrever as regras do Firebase Storage filtrando extensões permitidas (`.pdf, .jpg, .jpeg, .png, .docx, .xlsx`) e bloqueando mime-types/extensões maliciosas. |
| **SEC-04** | **Subida de Perfis e Escalação de Privilégios no Firestore** | Qualquer usuário autenticado no app poderia atualizar seu próprio perfil redefinindo administrativamente sua `accessLevel` p/ "Administrador de Sistema". | **Alta** | `/firestore.rules` | Proibir explicitamente que usuários alterem a chave de privilégios (`accessLevel` ou `role`) em seus perfis locais. |
| **SEC-05** | **Armazenamento de Dados de Contato (PII) em Texto Claro** | Telefone e e-mail armazenados sem cifragem básica expondo dados sensíveis no banco. | **Média** | `/src/App.tsx` | Aplicar criptografia simétrica reversível leve (Base64 com cifra XOR baseada em chave rotacional) antes de gravar esses dados de identificadores no Firestore. |
| **SEC-06** | **Ausência de Trilha de Auditoria Histórica de Eventos Clínicos** | Operações sensíveis de aprovação financeira, exclusão e login/logout não deixam rastro imutável de log para conformidade regulatória. | **Alta** | Arquitetura Geral | Criar a coleção `/auditLogs` com restrições severas de escrita e desativação total de alteração/exclusão na camada de regras do banco. |
| **SEC-07** | **Ataques de Força Bruta por Tentativa de Login Indefinido** | Falta de rate-limiting nas rotas de login no frontend facilita enumeração de chaves por dicionário estruturado. | **Média** | `/src/App.tsx` | Implementar bloqueio temporário após 5 tentativas falhas de login usando temporizador robusto em cache LocalStorage. |
| **SEC-08** | **Inexistência de Política de Expiração de Sessão por Inatividade** | Se um terminal persistir aberto no navegador, o token permanece ativo indefinidamente. | **Média** | `/src/App.tsx` | Desenvolver um gerenciador de inatividade em background que força o `signOut()` após 30 minutos sem ações (`mousemove`, `keypress`). |
| **SEC-09** | **Ausência de MFA e Extensão para Microsoft Entra ID** | Sem canal ou estrutura escalável para ativação de MFA. | **Média** | `/src/App.tsx` | Criar módulo desacoplado para integração nativa com o Active Directory/Entra ID e Microsoft 365, com ganchos de Autenticação Multifator. |

---

## 3. PLANO DE EXECUÇÃO E HARDENING

O plano de remediação estrutural será executado respeitando integralmente a compatibilidade mobile de componentes do Capacitor/Android e a integridade de regras sem quebra operacional.

1. **Desenvolvimento do Módulo Criptográfico (`/src/utils/crypto.ts`)**: Cifragem de campos de contato sensíveis.
2. **Desenvolvimento do Inicializador Microsoft Integration (`/src/utils/microsoftIntegration.ts`)**: Prontidão corporativa para Azure / Entra ID.
3. **Remediação do Firestore e Regras de Segurança (`/firestore.rules`)**: Aplicação dos 8 Pilares de Segurança.
4. **Alinhamento do Firebase Storage (`/storage.rules`)**: Filtro binário e sanitização de extensões autorizadas.
5. **Hardening do Frontend (`/src/App.tsx`)**:
   - Sanitização de inputs para prevenir XSS/Injection.
   - Implementação de limites de inatividade e bloqueio de força bruta de login.
   - Injeção das restrições de Obra/Projeto de forma estática do Firestore.
   - Integração da coleção imutável `auditLogs`.

---

## 4. CHECKLIST DE CONFORMIDADE CORPORATIVA

- [ ] Proteção estrita do Firestore contra alterações arbitrárias.
- [ ] Regras de Firebase Storage alinhadas.
- [ ] Auditoria imutável de logs ativa.
- [ ] Cifragem de dados sensíveis na gravação.
- [ ] Timeout de login por inatividade (30m).
- [ ] Prevenção de XSS e Sanitização ativa.

---
**Auditor Técnico Responsável:** AI Security Architect - Google AI Studio Build (AXIA ENERGIA Team)
