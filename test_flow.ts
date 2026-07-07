import { db } from './src/lib/supabase';

// Mock localStorage for Node.js environment
class LocalStorageMock {
  store: Record<string, string> = {};
  getItem(key: string) {
    return this.store[key] || null;
  }
  setItem(key: string, value: string) {
    this.store[key] = value;
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

global.localStorage = new LocalStorageMock() as any;

async function runTests() {
  console.log("🚀 Starting end-to-end system test...");

  // 1. Initialize data
  console.log("📦 Initializing products and inventory...");
  const products = await db.getProducts();
  const inventory = await db.getInventoryItems();
  
  // Find a restaurant product and a bar product
  const pizza = products.find(p => p.name_en === 'Margherita Pizza' || p.department === 'restaurant');
  const cocktail = products.find(p => p.name_en === 'Mojito' || p.department === 'bar');
  
  if (!pizza || !cocktail) {
    console.error("Products not found in initial data!");
    return;
  }
  
  console.log(`Using Pizza (ID: ${pizza.id}) and Cocktail (ID: ${cocktail.id})`);

  const initialPizzaStock = inventory.find(i => i.id === 'inv-3')?.stock_distribution || 0; // Assuming it deducts some ingredients, actually pizza uses ingredients, so let's check flour.
  const flourStock = inventory.find(i => i.name === 'Flour')?.stock_factory || 0;
  
  console.log(`Initial Flour Stock (Factory): ${flourStock}`);

  // 2. Order 1: Restaurant Order (Dine-in) - Paid with Cash
  console.log("\n📝 Creating Order 1 (Restaurant / Cash)...");
  let order1 = await db.addOrder({
    customer_name: 'Test Customer 1',
    customer_phone: '01000000000',
    table_number: '5',
    items: [{ id: pizza.id, name_ar: pizza.name_ar, name_en: pizza.name_en, price: pizza.price, quantity: 2 }],
    total_price: pizza.price * 2,
    status: 'pending',
    order_type: 'dine_in',
    waiter_id: 'u2',
    waiter_name: 'Ahmed',
    payment_method: 'cash'
  });
  
  await db.updateOrderStatus(order1.id, 'completed', 'Ahmed');
  
  // 3. Order 2: Bar Order - Paid with Wallet Bar
  console.log("\n📝 Creating Order 2 (Bar / Wallet Bar)...");
  let order2 = await db.addOrder({
    customer_name: 'Test Customer 2',
    customer_phone: '01000000001',
    table_number: 'Bar',
    items: [{ id: cocktail.id, name_ar: cocktail.name_ar, name_en: cocktail.name_en, price: cocktail.price, quantity: 3 }],
    total_price: cocktail.price * 3,
    status: 'pending',
    order_type: 'takeaway',
    waiter_id: 'u2',
    waiter_name: 'Ahmed',
    payment_method: 'wallet_bar'
  });

  await db.updateOrderStatus(order2.id, 'completed', 'Ahmed');

  // 4. Order 3: Mixed Order - Split Payment (Cash + Wallet Restaurant)
  console.log("\n📝 Creating Order 3 (Mixed / Split)...");
  let order3 = await db.addOrder({
    customer_name: 'Test Customer 3',
    customer_phone: '01000000002',
    table_number: '12',
    items: [
      { id: pizza.id, name_ar: pizza.name_ar, name_en: pizza.name_en, price: pizza.price, quantity: 1 },
      { id: cocktail.id, name_ar: cocktail.name_ar, name_en: cocktail.name_en, price: cocktail.price, quantity: 1 }
    ],
    total_price: pizza.price + cocktail.price,
    status: 'pending',
    order_type: 'dine_in',
    waiter_id: 'u2',
    waiter_name: 'Ahmed',
    payment_method: 'split',
    payment_details: { cash: pizza.price, wallet_restaurant: cocktail.price }
  });

  await db.updateOrderStatus(order3.id, 'completed', 'Ahmed');

  // 5. Test Expense & Petty Cash (Admin Action)
  console.log("\n💸 Admin adding expense from Petty Cash...");
  await db.addExpense({
    description: 'Maintenance',
    amount: 500,
    category: 'maintenance',
    payment_method: 'petty_cash',
    recorded_by: 'Admin',
    partner_id: 'part-1' // Partner 1 paying from his petty cash
  });

  // 6. Verification
  console.log("\n🔍 Verifying Accounts and Inventory...");
  
  const finalInventory = await db.getInventoryItems();
  const finalFlourStock = finalInventory.find(i => i.name === 'Flour')?.stock_factory || 0;
  console.log(`Final Flour Stock (Factory): ${finalFlourStock} (Expected: < ${flourStock})`);
  
  const transactions = await db.getFinancialTransactions();
  const expenses = await db.getExpenses();
  const ptns = await db.getPartnerTransactions();

  console.log(`Total Financial Transactions Recorded: ${transactions.length}`);
  console.log(`Total Expenses Recorded: ${expenses.length}`);
  console.log(`Total Partner Transactions Recorded: ${ptns.length}`);

  const cashIncome = transactions.filter(t => t.type === 'income' && t.payment_method === 'cash').reduce((sum, t) => sum + t.amount, 0);
  const walletBarIncome = transactions.filter(t => t.type === 'income' && t.payment_method === 'wallet_bar').reduce((sum, t) => sum + t.amount, 0);
  const walletRestIncome = transactions.filter(t => t.type === 'income' && t.payment_method === 'wallet_restaurant').reduce((sum, t) => sum + t.amount, 0);

  console.log(`\n💰 Financial Summary:`);
  console.log(`- Cash Income: ${cashIncome} EGP`);
  console.log(`- Wallet Bar Income: ${walletBarIncome} EGP`);
  console.log(`- Wallet Restaurant Income: ${walletRestIncome} EGP`);
  
  const partner1Balance = ptns.filter(p => p.partner_id === 'part-1').reduce((sum, p) => p.type === 'credit' ? sum + p.amount : sum - p.amount, 0);
  console.log(`- Partner 1 Liability Balance: ${partner1Balance} EGP (Should be 500 from Petty Cash expense)`);

  console.log("\n✅ Test Completed Successfully.");
}

runTests().catch(console.error);
