import OrderClient from '../../../components/OrderClient';

export default async function OrderPage({ params }) {
  const { id } = await params;
  return <OrderClient id={id} />;
}