import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

test('renders app container', () => {
    const { container } = render(
        <BrowserRouter>
            <App />
        </BrowserRouter>
    );
    expect(container.querySelector('.App')).toBeInTheDocument();
});
