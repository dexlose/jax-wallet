// pages/wallet/dashboard.tsx

import dynamic from "next/dynamic";

const DashboardPage = dynamic(() => import("../../components/DashboardPage"), {
  ssr: false,
});

export default DashboardPage;
