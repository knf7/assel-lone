import { authAPI, getGoogleAuthUrl, loansAPI, customersAPI } from './api';

describe('API', () => {
    it('getGoogleAuthUrl returns URL ending with /auth/google', () => {
        const url = getGoogleAuthUrl();
        expect(url).toMatch(/\/auth\/google$/);
    });

    it('authAPI has login, register, getGoogleAuthUrl', () => {
        expect(typeof authAPI.login).toBe('function');
        expect(typeof authAPI.register).toBe('function');
        expect(authAPI.getGoogleAuthUrl).toBe(getGoogleAuthUrl);
    });

    it('loansAPI has getAll, create, upload', () => {
        expect(typeof loansAPI.getAll).toBe('function');
        expect(typeof loansAPI.create).toBe('function');
        expect(typeof loansAPI.upload).toBe('function');
    });

    it('customersAPI create expects fullName, nationalId, mobileNumber', () => {
        expect(typeof customersAPI.create).toBe('function');
    });
});
