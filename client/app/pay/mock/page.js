import MockPayClient from '../../../components/MockPayClient';

export default async function MockPayPage({ searchParams }) {
  const { order } = await searchParams;
  return <MockPayClient orderId={order} />;
}