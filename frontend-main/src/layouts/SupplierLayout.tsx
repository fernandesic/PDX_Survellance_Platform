import React from 'react';
import { Outlet } from 'react-router-dom';

const SupplierLayout: React.FC = () => {
    return (
        <div className="supplier-root min-h-screen bg-[#F8FAFC] font-sans">
            <main className="w-full">
                <Outlet />
            </main>
        </div>
    );
};

export default SupplierLayout;
