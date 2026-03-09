'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface Subscription {
    id: number;
    plan_category: string;
    status: 'active' | 'suspended' | 'cancelled' | 'pending';
    start_date: string;
    end_date: string;
    stripe_customer_id: string;
    stripe_subscription_id: string;
}

export interface WorkspaceSettings {
    merchant: {
        id: number;
        business_name: string;
        email: string;
        mobile_number: string;
        subscription_status: string;
    };
    subscription: Subscription | null;
}

export function useWorkspaceSettings() {
    return useQuery({
        queryKey: ['settings'],
        queryFn: async (): Promise<WorkspaceSettings> => {
            // Adjusted based on the original typical SaaS endpoints you might have
            const { data } = await api.get('/admin/merchant/profile');
            return data;
        },
        // We don't want to retry if the endpoint fails (like if user is not admin)
        retry: 1,
    });
}
