// routes/payments.js
import { Router } from 'express';
import axios from "axios";
import dotenv from "dotenv";
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

dotenv.config();

// Configuração do Mercado Pago
const client = new MercadoPagoConfig({ 
  accessToken: process.env.MP_ACCESS_TOKEN,
  options: { timeout: 5000
    //, idempotencyKey: 'abc' // Remover idempotencyKey para permitir múltiplos pagamentos
  }
});

const preference = new Preference(client);
const payment = new Payment(client);

const getFirstAndLastSurname = (name) => {
  if (!name) return { first: '', last: '' };

  const parts = name.trim().split(/\s+/); // divide por espaços múltiplos

  if (parts.length === 1) {
    // só tem um nome (ex: "João")
    return { first: parts[0], last: parts[0] };
  }

  if (parts.length === 2) {
    // ex: "João Humberto"
    return { first: parts[0], last: parts[1] };
  }

  // Mais de duas palavras
  return {
    first: parts[0],                  // primeiro sobrenome (segunda palavra)
    last: parts[parts.length - 1]     // último sobrenome
  };
}

const setAssinaturas = async (pixData, idUser, esClient) => {
   await setIspremium(idUser, esClient, true)
   await setPaymentControl(pixData, idUser, esClient)
}

const setIspremium = async (idUser, esClient, novoValor = false) => { 
    try {
        const response = await esClient.update({
            index: 'users',
            id: idUser,
            body: {
                doc: {
                    is_premium: novoValor
                }
            }
        });
        console.log('✅ Campo is_premium atualizado:', response);
    } catch (error) {
        console.error('❌ Erro ao atualizar is_premium:', error);
        throw error;
    }
};

const setPaymentControl = async (pixData, idUser, esClient) => { 
    const hoje = new Date();
    try {
        const response = await esClient.index({
          index: 'pagamentos',
          id: pixData.id,
          body: {
            user_id: idUser,
            data_pagamento: hoje,
            valor: pixData.amount,
            forma_pagamento: 'pix',
            referencia_pagamento: 'mes/ano',
            status: pixData.status
          }
        })

        console.log('✅ Set payment control no elastc', response);
        await setAssinaturasControle(idUser, esClient)
    } catch (error) {
        console.log('error paymentControle');
    }
}

const setAssinaturasControle = async (idUser, esClient) => {
    const hoje = new Date();
    const pagamentoData = new Date();
    const diasParaAdicionar = 30;
    let novaDataFim;

    try {
        const assinatura = await getAssinaturasPorUserId(esClient, idUser);
        
        if (assinatura && new Date(assinatura.fim_vigencia) > hoje) {
            // Adicionar 30 dias ao fim atual
            novaDataFim = new Date(assinatura.fim_vigencia);
            novaDataFim.setDate(novaDataFim.getDate() + diasParaAdicionar);
        } else {
            // Começar nova assinatura a partir da data do pagamento
            novaDataFim = new Date(pagamentoData);
            novaDataFim.setDate(novaDataFim.getDate() + diasParaAdicionar);
        }

        const response = await esClient.index({
            index: 'assinaturas',
            id: idUser,
            body: {
                user_id: idUser,
                inicio_vigencia: hoje,
                fim_vigencia: novaDataFim,
                atualizado_em: hoje
            }
        });
        console.log('✅ Set assintura controle no elastc', response);

    } catch (error) {
        console.log('error assinatura controle');
    }
}

const getAssinaturasPorUserId = async (esClient, idUser) => {
    try {
        const { body } = await esClient.get({
            index: 'assinaturas',
            id: idUser
        });
    
        return body._source
    } catch (error) {
        return null
    }
}

export default function createForumRouter({ openai, es }) {
    const router = Router();

    router.get('/pay', (req, res) => {
        res.json({ message: 'API Mercado Pago funcionando 1!' });
    });

    // Criar preferência PIX
    router.post('/create-pix', async (req, res) => {
        try {
            const { amount, email, description = process.env.PRODUCT_NAME, name, id } = req.body;

            console.log('req.body', req.body);

            // Gerar identificadores únicos para evitar duplicatas
            const timestamp = Date.now()
            const randomSuffix = Math.random().toString(36).substring(2, 8)
            const uniqueExternalRef = `pix_${timestamp}_${randomSuffix}`
            
            console.log('Criando PIX com external_reference:', uniqueExternalRef)
            console.log('Valor:', amount, 'Email:', email)

            const paymentData = {
            transaction_amount: parseFloat(amount),
            description: `${description} - ${timestamp}`, // Tornar descrição única também
            payment_method_id: 'pix',
            payer: {
                email: email,
                first_name: getFirstAndLastSurname(name).first,
                last_name: getFirstAndLastSurname(name).last
            },
            external_reference: uniqueExternalRef,
            notification_url: `${process.env.BACKEND_URL || 'https://seudominio.com'}/api/webhooks/mercadopago`,
            date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            // Adicionar metadata única para forçar novo pagamento
            metadata: {
                created_at: new Date().toISOString(),
                unique_id: uniqueExternalRef,
                amount: parseFloat(amount),
                version: '1.0'
            }
            };

            console.log('Criando pagamento PIX:', paymentData);

            // Criar nova instância do Payment para evitar cache
            const paymentInstance = new Payment(new MercadoPagoConfig({ 
                accessToken: process.env.MP_ACCESS_TOKEN,
                options: { timeout: 5000 }
            }));

            const result = await paymentInstance.create({ 
                body: paymentData,
                // Não usar requestOptions com idempotency
            });
            
            console.log('PIX criado com sucesso:', {
                id: result.id,
                status: result.status,
                external_reference: result.external_reference,
                amount: result.transaction_amount,
                qr_code_exists: !!result.point_of_interaction?.transaction_data?.qr_code
            });

            // Extrair dados do PIX
            const pixData = {
                id: result.id,
                status: result.status,
                external_reference: result.external_reference,
                amount: result.transaction_amount,
                currency: result.currency_id,
                qr_code: result.point_of_interaction?.transaction_data?.qr_code || null,
                qr_code_base64: result.point_of_interaction?.transaction_data?.qr_code_base64 || null,
                ticket_url: result.point_of_interaction?.transaction_data?.ticket_url || null,
                expiration_date: result.date_of_expiration
            };

            res.json(pixData);
        } catch (error) {
            console.error('Erro ao criar PIX:', error);
            console.error('Detalhes do erro:', error.response?.data || error.message);
            res.status(500).json({ 
                error: 'Erro interno do servidor', 
                details: error.response?.data || error.message 
            });
        }
    });

    // Criar preferência Cartão de Crédito
    router.post('/create-card', async (req, res) => {
        try {
            const { amount, email, installments = 1, description = process.env.PRODUCT_NAME } = req.body;

            const preferenceData = {
            items: [{
                title: description,
                unit_price: parseFloat(amount),
                quantity: 1,
                currency_id: 'BRL'
            }],
            payer: {
                email: email
            },
            payment_methods: {
                excluded_payment_methods: [],
                excluded_payment_types: [
                { id: 'ticket' },
                { id: 'bank_transfer' },
                { id: 'atm' }
                ],
                installments: parseInt(installments),
                default_payment_method_id: null
            },
            back_urls: {
                success: `${process.env.FRONTEND_URL}/payment/success`,
                failure: `${process.env.FRONTEND_URL}/payment/failure`,
                pending: `${process.env.FRONTEND_URL}/payment/pending`
            },
            auto_return: 'approved',
            external_reference: `card_${Date.now()}`
            };

            const result = await preference.create({ body: preferenceData });
            
            res.json({
            id: result.id,
            init_point: result.init_point,
            sandbox_init_point: result.sandbox_init_point,
            external_reference: result.external_reference
            });
        } catch (error) {
            console.error('Erro ao criar pagamento cartão:', error);
            res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
        }
    });

    // Criar assinatura (recorrente)
    router.post('/create-subscription', async (req, res) => {
        try {
            const { amount, email, frequency = 'monthly', description = process.env.PRODUCT_NAME } = req.body;

            // Para assinaturas, você pode usar a API de Preapproval
            const preferenceData = {
                reason: `Assinatura ${description}`,
                auto_recurring: {
                    frequency: 1,
                    frequency_type: frequency, // 'monthly', 'days', 'weeks'
                    transaction_amount: parseFloat(amount),
                    currency_id: 'BRL'
                },
                payer_email: email,
                back_url: `${process.env.FRONTEND_URL}/subscription/success`,
                external_reference: `sub_${Date.now()}`
            };

            // Nota: Para assinaturas completas, use a API de Preapproval
            // Por ora, vamos criar uma preferência normal e você pode implementar a lógica de recorrência
            const result = await preference.create({ 
            body: {
                items: [{
                title: `${description} - Assinatura ${frequency}`,
                unit_price: parseFloat(amount),
                quantity: 1,
                currency_id: 'BRL'
                }],
                payer: { email: email },
                external_reference: `sub_${Date.now()}`
            }
            });
            
            res.json({
            subscription_id: result.id,
            init_point: result.init_point,
            sandbox_init_point: result.sandbox_init_point,
            message: 'Assinatura criada. Implemente lógica de recorrência no webhook.'
            });
        } catch (error) {
            console.error('Erro ao criar assinatura:', error);
            res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
        }
    });

    // Consultar status do pagamento
    router.get('/status/:paymentId', async (req, res) => {
        try {
            const { paymentId } = req.params;
            const paymentInfo = await payment.get({ id: paymentId });
            
            res.json({
                id: paymentInfo.id,
                status: paymentInfo.status,
                status_detail: paymentInfo.status_detail,
                amount: paymentInfo.transaction_amount,
                currency: paymentInfo.currency_id,
                payment_method: paymentInfo.payment_method_id,
                external_reference: paymentInfo.external_reference,
                date_created: paymentInfo.date_created,
                date_approved: paymentInfo.date_approved
            });
        } catch (error) {
            console.error('Erro ao consultar pagamento:', error);
            res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
        }
    });

    //mudar assinatura
    router.post('/changeAssinatura', async (req, res) => {
        try {
            const { paymentId, userId } = req.body

            const paymentInfo = await payment.get({ id: paymentId });

            const pixData = {
                id: paymentInfo.id,
                status: paymentInfo.status,
                status_detail: paymentInfo.status_detail,
                amount: paymentInfo.transaction_amount,
                currency: paymentInfo.currency_id,
                payment_method: paymentInfo.payment_method_id,
                external_reference: paymentInfo.external_reference,
                date_created: paymentInfo.date_created,
                date_approved: paymentInfo.date_approved
            }

            console.log('pixData', pixData);
            console.log('userId', userId);

            if(pixData.status === 'approved') await setAssinaturas(pixData, userId, es)

            res.json({
               status: "ok"
            })
            
        } catch (error) {
            console.log('error change assintura');
             res.json({
                status: "error"
             })
        }
    })

    return router;
}






