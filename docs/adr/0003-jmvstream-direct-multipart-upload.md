---
status: accepted
owner: engineering
last_verified_commit: 888ad2f8addddef9dec4f11bacad8580ffb7181b
---

# ADR-0003 Upload multipart direto para JMVStream

## Contexto

Vídeos podem ser grandes. Fazer o payload atravessar o servidor do Hub aumenta tempo, memória, custo e risco de timeout. A API JMVStream oferece início multipart com URLs assinadas e confirmação final.

## Decisão

O servidor autentica, cria pasta/sessão e inicia upload. O navegador envia partes diretamente ao storage indicado pela JMVStream e coleta ETags. O servidor envia o complete e persiste/sincroniza o ativo. Não usar proxy de bytes nem TUS no Hub.

Configuração vigente: partes de 64 MiB, concorrência quatro, até 10.000 partes e 5 TiB, respeitando mínimo S3 de 5 MiB.

## Alternativas consideradas

- proxy pelo Hub: controle central, porém custos e limites impróprios para vídeo;
- TUS: retomada padronizada, mas não é o contrato oferecido pelo fluxo escolhido;
- URL fetch a partir do R2: adicionaria armazenamento intermediário e lifecycle duplicado.

## Consequências

- CORS e ETag legível são requisitos externos;
- sessão persistida permite recuperação e limpeza;
- retry de parte é local; complete deve ser idempotente/recuperável;
- credencial JMVStream fica somente no servidor;
- divergência de contrato do payload `gallery` precisa ser resolvida antes de alterar o código.

## Evidências

`getJmvstreamMultipartUploadConfig`, `uploadFileParts`, `initJmvstreamUpload`, `completeJmvstreamUpload`, `syncPendingJmvstreamPlayers`; documentação oficial [Public API JMVStream](https://jmvstream.com/en/developer).
