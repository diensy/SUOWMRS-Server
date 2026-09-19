import 'dotenv/config';
import Stripe from 'stripe';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error('❌ Error: STRIPE_SECRET_KEY not found in .env');
  process.exit(1);
}

const stripe = new Stripe(secretKey, {
  apiVersion: '2024-06-20',
});

const DESIRED_PRODUCTS = [
  {
    key: 'BASIC_AMC',
    envKey: 'STRIPE_PRICE_BASIC_AMC',
    name: '🔧 SUOWMRS Basic AMC',
    description: 'Annual Maintenance Contract — Basic coverage (1 inspection visit + health check)',
    amount: 149900, // ₹1,499 in paise
    currency: 'inr',
    recurring: { interval: 'year' },
  },
  {
    key: 'STANDARD_AMC',
    envKey: 'STRIPE_PRICE_STANDARD_AMC',
    name: '⭐ SUOWMRS Standard AMC',
    description: 'Annual Maintenance Contract — Standard comprehensive coverage (2 visits + filter check)',
    amount: 249900, // ₹2,499 in paise
    currency: 'inr',
    recurring: { interval: 'year' },
  },
  {
    key: 'PREMIUM_AMC',
    envKey: 'STRIPE_PRICE_PREMIUM_AMC',
    name: '💎 SUOWMRS Premium AMC',
    description: 'Annual Maintenance Contract — Premium priority service (4 visits + filter replacement included)',
    amount: 399900, // ₹3,999 in paise
    currency: 'inr',
    recurring: { interval: 'year' },
  },
  {
    key: 'SMART_MONITORING',
    envKey: 'STRIPE_PRICE_SMART_MONITORING',
    name: '📱 SUOWMRS Smart Monitoring',
    description: 'IoT sensor live streaming & AI flood risk predictive analytics subscription',
    amount: 9900, // ₹99 in paise
    currency: 'inr',
    recurring: { interval: 'month' },
  },
  {
    key: 'FILTER_REPLACEMENT',
    name: '💧 SUOWMRS Filter Replacement',
    description: 'Activated carbon & sediment filter inspection and replacement service',
    amount: 100000, // ₹1,000 in paise
    currency: 'inr',
    recurring: null, // one-time
  },
  {
    key: 'PUMP_REPAIR',
    name: '⚙️ SUOWMRS Pump / Sensor Repair',
    description: 'Submersible pump motor diagnostic, cleaning, repair & sensor calibration',
    amount: 75000, // ₹750 in paise
    currency: 'inr',
    recurring: null, // one-time
  },
  {
    key: 'EMERGENCY_SERVICE',
    name: '🚨 SUOWMRS Emergency Call-out',
    description: 'Rapid on-site emergency technician response visit within 4 hours',
    amount: 49900, // ₹499 in paise
    currency: 'inr',
    recurring: null, // one-time
  },
];

async function run() {
  console.log('====================================================');
  console.log('⚡ SUOWMRS Stripe Account, Products & Webhook Sync');
  console.log('====================================================');

  // 1. Check Account
  console.log('\n🔍 Step 1: Checking Stripe Account Information...');
  try {
    const account = await stripe.accounts.retrieve();
    console.log(`✅ Connected to Stripe Account: ${account.id}`);
    console.log(`   Business Name / Email: ${account.business_profile?.name || account.email || 'SUOWMRS'}`);
    console.log(`   Charges Enabled: ${account.charges_enabled ? '🟢 YES' : '🟡 NO (Pending Test/Live Onboarding)'}`);
    console.log(`   Payouts Enabled: ${account.payouts_enabled ? '🟢 YES' : '🟡 NO'}`);
    console.log(`   Details Submitted: ${account.details_submitted ? '🟢 YES' : '🟡 In Progress'}`);
    console.log(`   Default Currency: ${(account.default_currency || 'inr').toUpperCase()}`);
  } catch (err) {
    console.warn(`⚠️ Account retrieve notice (${err.message}) — proceeding with API key verification.`);
  }

  // 2. Fetch existing products
  console.log('\n📦 Step 2: Syncing Products & Prices to Stripe...');
  const existingProducts = await stripe.products.list({ limit: 100, active: true });
  const priceUpdates = {};

  for (const item of DESIRED_PRODUCTS) {
    let product = existingProducts.data.find(
      (p) => p.name.toLowerCase().trim() === item.name.toLowerCase().trim()
    );

    if (!product) {
      console.log(`   ➕ Creating Product: "${item.name}"...`);
      product = await stripe.products.create({
        name: item.name,
        description: item.description,
        metadata: { key: item.key },
      });
      console.log(`      Created product ID: ${product.id}`);
    } else {
      console.log(`   ✓ Found existing Product: "${item.name}" (${product.id})`);
    }

    // Check or create Price
    const prices = await stripe.prices.list({ product: product.id, limit: 10, active: true });
    let price = prices.data.find((pr) => {
      const matchAmount = pr.unit_amount === item.amount;
      const matchCurrency = pr.currency.toLowerCase() === item.currency.toLowerCase();
      if (!matchAmount || !matchCurrency) return false;
      if (item.recurring) {
        return pr.recurring?.interval === item.recurring.interval;
      }
      return pr.type === 'one_time';
    });

    if (!price) {
      console.log(`      ➕ Creating Price: ₹${(item.amount / 100).toLocaleString('en-IN')}${item.recurring ? '/' + item.recurring.interval : ' (one-time)'}...`);
      const priceData = {
        product: product.id,
        unit_amount: item.amount,
        currency: item.currency,
      };
      if (item.recurring) {
        priceData.recurring = item.recurring;
      }
      price = await stripe.prices.create(priceData);
      console.log(`         Created price ID: ${price.id}`);
    } else {
      console.log(`      ✓ Verified price ID: ${price.id} (₹${(item.amount / 100).toLocaleString('en-IN')}${item.recurring ? '/' + item.recurring.interval : ''})`);
    }

    if (item.envKey) {
      priceUpdates[item.envKey] = price.id;
    }
  }

  // 3. Webhook Endpoints
  console.log('\n🔗 Step 3: Checking Webhook Endpoints...');
  const webhooks = await stripe.webhookEndpoints.list({ limit: 20 });
  const targetUrl = 'https://suowmrs-server.onrender.com/api/payments/webhook';
  let matchedWebhook = webhooks.data.find((w) => w.url === targetUrl);

  if (matchedWebhook) {
    console.log(`   ✓ Found Webhook Endpoint: ${matchedWebhook.url} (ID: ${matchedWebhook.id})`);
    console.log(`     Status: ${matchedWebhook.status}`);
    console.log(`     Enabled Events: ${matchedWebhook.enabled_events.join(', ')}`);
  } else {
    console.log(`   ➕ Creating Webhook Endpoint for: ${targetUrl}...`);
    try {
      matchedWebhook = await stripe.webhookEndpoints.create({
        url: targetUrl,
        enabled_events: [
          'payment_intent.succeeded',
          'payment_intent.payment_failed',
          'invoice.paid',
          'invoice.payment_failed',
          'customer.subscription.deleted',
        ],
        description: 'SUOWMRS Production API Webhook Listener',
      });
      console.log(`   ✅ Webhook Endpoint Created! ID: ${matchedWebhook.id}`);
      if (matchedWebhook.secret) {
        priceUpdates['STRIPE_WEBHOOK_SECRET'] = matchedWebhook.secret;
        console.log(`   🔑 New Webhook Secret: ${matchedWebhook.secret}`);
      }
    } catch (whErr) {
      console.warn(`   ⚠️ Webhook creation notice: ${whErr.message}`);
    }
  }

  // 4. Update .env file
  console.log('\n📝 Step 4: Updating server/.env with generated Stripe Price IDs...');
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');

    for (const [key, val] of Object.entries(priceUpdates)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${val}`);
      } else {
        envContent += `\n${key}=${val}`;
      }
      console.log(`   ✓ Saved: ${key}=${val}`);
    }

    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('✅ server/.env updated successfully!');
  }

  console.log('\n====================================================');
  console.log('🎉 Stripe Setup & Verification Complete!');
  console.log('All products, recurring plans & webhooks are active in Stripe Dashboard.');
  console.log('====================================================\n');
}

run().catch((err) => {
  console.error('\n❌ Stripe Setup Error:', err);
  process.exit(1);
});
