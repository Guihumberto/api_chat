// routes/webhooks.js

import { Router } from 'express';
import axios from "axios";
import dotenv from "dotenv";
import { MercadoPagoConfig, Payment } from 'mercadopago';

dotenv.config();

const client = new MercadoPagoConfig({ 
  accessToken: process.env.MP_ACCESS_TOKEN 
});

const payment = new Payment(client);

// Funções de handle dos pagamentos
async function handleApprovedPayment(paymentInfo) {
  console.log('✅ Pagamento aprovado:', paymentInfo.external_reference);
  
  // Implementar sua lógica aqui:
  // - Salvar no banco de dados
  // - Enviar email de confirmação
  // - Liberar acesso ao produto
  // - Para assinaturas: agendar próximo cobrança
}

async function handlePendingPayment(paymentInfo) {
  console.log('⏳ Pagamento pendente:', paymentInfo.external_reference);
  
  // Implementar sua lógica aqui:
  // - Enviar email informando que está processando
  // - Atualizar status no banco
}

async function handleRejectedPayment(paymentInfo) {
  console.log('❌ Pagamento rejeitado:', paymentInfo.external_reference);
  
  // Implementar sua lógica aqui:
  // - Enviar email informando rejeição
  // - Sugerir nova tentativa
  // - Atualizar status no banco
}

export default function createForumRouter({ openai, es }) {
    const router = Router();

    router.get('/pay', (req, res) => {
        res.json({ message: 'API Mercado Pago funcionando 2!' });
    });

    // Webhook do Mercado Pago
    router.post('/mercadopago', async (req, res) => {
    try {
        const { type, data } = req.body;
        
        console.log('Webhook recebido:', { type, data });

        if (type === 'payment') {
        const paymentId = data.id;
        
        // Buscar informações do pagamento
        const paymentInfo = await payment.get({ id: paymentId });
        
        console.log('Pagamento atualizado:', {
            id: paymentInfo.id,
            status: paymentInfo.status,
            external_reference: paymentInfo.external_reference,
            amount: paymentInfo.transaction_amount
        });

        // Aqui você implementa sua lógica de negócio
        switch (paymentInfo.status) {
            case 'approved':
            // Pagamento aprovado - liberar produto/serviço
            await handleApprovedPayment(paymentInfo);
            break;
            case 'pending':
            // Pagamento pendente
            await handlePendingPayment(paymentInfo);
            break;
            case 'rejected':
            // Pagamento rejeitado
            await handleRejectedPayment(paymentInfo);
            break;
        }
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('Erro no webhook:', error);
        res.status(500).send('Erro interno');
    }
    });

    return router;
}