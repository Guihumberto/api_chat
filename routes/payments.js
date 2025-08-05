// routes/payments.js
import { Router } from 'express';
import axios from "axios";
import dotenv from "dotenv";
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

dotenv.config();

// Configuração do Mercado Pago
const client = new MercadoPagoConfig({ 
  accessToken: process.env.MP_ACCESS_TOKEN,
  options: { timeout: 5000, idempotencyKey: 'abc' }
});

const preference = new Preference(client);
const payment = new Payment(client);

export default function createForumRouter({ openai, es }) {
    const router = Router();

    router.get('/pay', (req, res) => {
        res.json({ message: 'API Mercado Pago funcionando 1!' });
    });

    // Criar preferência PIX
    router.post('/create-pix', async (req, res) => {
        try {
            const { amount, email, description = process.env.PRODUCT_NAME } = req.body;

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
                    excluded_payment_types: [],
                    installments: 1,
                    default_payment_method_id: null,
                    default_installments: null
                },
                back_urls: {
                    success: `${process.env.FRONTEND_URL}/payment/success`,
                    failure: `${process.env.FRONTEND_URL}/payment/failure`,
                    pending: `${process.env.FRONTEND_URL}/payment/pending`
                },
                auto_return: 'approved',
                external_reference: `pix_${Date.now()}`,
                expires: true,
                expiration_date_from: new Date().toISOString(),
                expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min
            };

            const result = await preference.create({ body: preferenceData });
            
            res.json({
                id: result.id,
                init_point: result.init_point,
                sandbox_init_point: result.sandbox_init_point,
                external_reference: result.external_reference
            });
        } catch (error) {
            console.error('Erro ao criar PIX:', error);
            res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
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
            status: paymentInfo.status,
            status_detail: paymentInfo.status_detail,
            amount: paymentInfo.transaction_amount,
            currency: paymentInfo.currency_id,
            payment_method: paymentInfo.payment_method_id,
            external_reference: paymentInfo.external_reference
            });
        } catch (error) {
            console.error('Erro ao consultar pagamento:', error);
            res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
        }
    });

    return router;
}






