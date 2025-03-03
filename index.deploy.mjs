import express from 'express';
import bodyParser from 'body-parser';
import Stripe from 'stripe';
import dotenv from 'dotenv'; // dotenvパッケージをインポート

// .env ファイルを読み込む
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY); // 環境変数からシークレットキーを取得

const app = express();
app.use(bodyParser.json());

const generateUniqueTransactionId = () => {
  return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// 申請者のチェックアウトセッションを作成するエンドポイント
app.post('/create-applicant-checkout', async (req, res) => {
  const { applicantId, friendRequestId, reviewerId, payerId } = req.body; // PayerIDを取得

  console.log('Request Body:', req.body);

  try {
    const customer = await stripe.customers.create({
      metadata: {
        applicantId,
        friendRequestId,
        reviewerId,
        payerId, // メタデータにPayerIDを追加
      },
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'jpy',
          product_data: {
            name: 'マッチング費用',
          },
          unit_amount: 300,
        },
        quantity: 1,
      }],
      mode: 'payment',
      payment_intent_data: {
        capture_method: 'manual',
      },
      success_url: `https://pipeline.jpn.com/version-live/payment-succes`,
      cancel_url: `https://pipeline.jpn.com/version-live/payment-cancel`,
      customer: customer.id,
      metadata: {
        friendRequestId,
        applicantId,
        reviewerId,
        payerId, // メタデータにPayerIDを追加
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating applicant checkout session:', error);
    res.status(500).send('Internal Server Error');
  }
});

// 検討者のチェックアウトセッションを作成するエンドポイント
app.post('/create-reviewer-checkout', async (req, res) => {
  const { reviewerId, friendRequestId, applicantId, payerId } = req.body; // PayerIDを取得

  try {
    const customer = await stripe.customers.create({
      metadata: {
        reviewerId,
        friendRequestId,
        applicantId,
        payerId, // メタデータにPayerIDを追加
      },
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'jpy',
          product_data: {
            name: 'マッチング費用',
          },
          unit_amount: 300,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `https://pipeline.jpn.com/version-live/payment-success`,
      cancel_url: `https://pipeline.jpn.com/version-live/payment-cancel`,
      customer: customer.id,
      metadata: {
        friendRequestId,
        reviewerId,
        applicantId,
        payerId, // メタデータにPayerIDを追加
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating reviewer checkout session:', error);
    res.status(500).send('Internal Server Error');
  }
});

// オーソリをキャプチャするエンドポイント
app.post('/capture-payment', async (req, res) => {
  const { sessionId } = req.body;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paymentIntentId = session.payment_intent;

    if (paymentIntentId) {
      await stripe.paymentIntents.capture(paymentIntentId);
      res.send('Payment captured successfully');
    } else {
      res.status(400).send('PaymentIntent not found');
    }
  } catch (error) {
    console.error('Error capturing payment:', error);
    res.status(500).send('Internal Server Error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
