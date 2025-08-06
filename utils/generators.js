// utils/generators.js
import crypto from 'crypto';

// Gerar external reference único
function generateUniqueExternalReference(prefix = 'pix') {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${timestamp}_${random}`;
}

// Gerar ID único para idempotência (se necessário)
function generateIdempotencyKey() {
  return crypto.randomUUID();
}

// Gerar hash único baseado nos dados do pagamento
function generatePaymentHash(paymentData) {
  const dataString = JSON.stringify({
    amount: paymentData.transaction_amount,
    email: paymentData.payer.email,
    timestamp: Date.now(),
    random: Math.random()
  });
  
  return crypto.createHash('sha256').update(dataString).digest('hex').substring(0, 16);
}

export default {
  generateUniqueExternalReference,
  generateIdempotencyKey,
  generatePaymentHash
};