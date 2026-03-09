import { redirect } from 'next/navigation';

export default function AddLoanRedirect() {
    redirect('/dashboard/loans/new');
}
