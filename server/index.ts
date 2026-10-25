import app, { expireOldOrders } from './app';

setInterval(() => expireOldOrders().catch(console.error), 60_000);
app.listen(4000, () => console.log('Server on http://localhost:4000'));