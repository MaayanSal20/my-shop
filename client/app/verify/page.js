import VerifyClient from '../../components/VerifyClient';

export default async function VerifyPage({ searchParams }) {
  const { email } = await searchParams;
  return <VerifyClient email={email} />;
}