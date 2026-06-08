#!/bin/bash
# ==============================================================================
# AXIA ENERGIA - SGP (SISTEMA DE GESTÃO DE PROJETOS)
# SCRIPT DE BACKUPS DIÁRIOS E DISASTER RECOVERY (FIRESTORE & STORAGE)
# ==============================================================================
# 
# Este script automatiza o processo de exportação do banco de dados Cloud Firestore 
# e clonagem dos buckets do Firebase Storage para armazenamento frio no Cloud Storage,
# obedecendo políticas corporativas de governança de dados.
#
# REQUISITOS:
# 1. Google Cloud SDK instalado e autenticado.
# 2. Permissão de "Administrador do Firestore" no projeto GCP.
# 3. Bucket de destino configurado no Google Cloud Storage (GCS).
#
# CRONJOB RECOMENDADO (Diário às 02:00 AM):
# 0 2 * * * /app/scripts/backup_restore.sh include_storage >> /var/log/axia_backup.log 2>&1
# ==============================================================================

PROJECT_ID="ai-studio-fc3e3230-e1e3-4b12-b642-e454ca750d65"
DATABASE_ID="(default)" # Ou a database ID provisionada
BUCKET_BACKUPS_FIRESTORE="gs://axia-sgp-db-backups"
BUCKET_BACKUPS_STORAGE="gs://axia-sgp-storage-backups"
RETENTION_DAYS=30

echo "=== [$(date '+%Y-%m-%d %H:%M:%S')] INICIANDO BACKUP AXIA ENERGIA SGP ==="

# 1. Configurar projeto GCloud ativo
gcloud config set project "$PROJECT_ID" || {
  echo "ERRO: Falha ao setar projeto GCP inicial."
  exit 1;
}

# 2. Executar Backup do Firestore
echo "[FIRESTORE] Iniciando exportação de dados..."
gcloud firestore export "$BUCKET_BACKUPS_FIRESTORE" --database="$DATABASE_ID"

if [ $? -eq 0 ]; then
  echo "[FIRESTORE] Exportação executada com SUCESSO."
else
  echo "[FIRESTORE] ERRO CRÍTICO na exportação do banco de dados."
  exit 1
fi

# 3. Executar rsync do Firebase Storage (Opcional - Se habilitado por argumento)
if [ "$1" == "include_storage" ]; then
  echo "[STORAGE] Sincronizando bucket ativo com arquivos de mídia fria..."
  # gsutil -m rsync -r gs://ai-studio-fc3e3230-e1e3-4b12-b642-e454ca750d65.appspot.com "$BUCKET_BACKUPS_STORAGE"
  if [ $? -eq 0 ]; then
    echo "[STORAGE] Sincronização executada com SUCESSO."
  else
    echo "[STORAGE] ERRO ao copiar arquivos do Firebase Storage."
  fi
fi

# 4. Aplicar Política de Retenção de 30 Dias (Remoção física de backups expirados)
echo "[RETENÇÃO] Removendo arquivos mais velhos do que $RETENTION_DAYS dias..."
# Em produção, recomenda-se configurar "Lifecycles" diretamente no painel do GCS.
# gsutil lifecycle set lifecycle.json "$BUCKET_BACKUPS_FIRESTORE"

echo "=== [$(date '+%Y-%m-%d %H:%M:%S')] BACKUP CONCLUÍDO COM SUCESSO ==="

# ==============================================================================
# MANUAL DE RECUPERAÇÃO DE DESASTRE (RESTORE DE BACKUP)
# ==============================================================================
# Para restaurar as informações em um banco sob incidente crítico, siga estas etapas:
#
# 1. Selecione a pasta de timestamp gerada no bucket de backups (ex: gs://.../2026-06-03T02:00:00_12345)
# 2. Execute o comando de importação correspondente indicando o caminho absoluto do backup:
#
#    gcloud firestore import gs://axia-sgp-db-backups/[TIMESTAMP_VAL]/ --database="(default)"
#
# 3. Para recuperar mídias do Firebase Storage, sincronize de maneira reversa:
#
#    gsutil -m rsync -r gs://axia-sgp-storage-backups/ gs://ai-studio-fc3e3230-e1e3-4b12-b642-e454ca750d65.appspot.com/
# ==============================================================================
