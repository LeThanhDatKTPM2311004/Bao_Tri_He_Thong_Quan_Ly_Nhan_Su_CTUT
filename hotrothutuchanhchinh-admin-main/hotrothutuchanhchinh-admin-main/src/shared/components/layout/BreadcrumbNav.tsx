import { Breadcrumb } from 'antd';

import { Link, useLocation } from 'react-router-dom';



const routeLabels: Record<string, string> = {

  dashboard: 'Tổng quan',

  forms: 'Biểu mẫu',
  'bulk-import': 'Nhập đơn từ Excel',

  workflows: 'Quy trình',

  pending: 'Hồ sơ chờ xử lý',

  processed: 'Hồ sơ đã xử lý',

  requests: 'Danh sách yêu cầu',

  notifications: 'Thông báo',

  reports: 'Báo cáo & Thống kê',

  users: 'Người dùng',

  account: 'Tài khoản',

  organization: 'Tổ chức',

};



export function BreadcrumbNav() {

  const location = useLocation();

  const segments = location.pathname.split('/').filter(Boolean);



  const items = [

    { title: <Link to="/dashboard">Trang chủ</Link> },

    ...segments.map((seg, i) => ({

      title:

        i === segments.length - 1 ? (

          routeLabels[seg] ?? seg

        ) : (

          <Link to={`/${segments.slice(0, i + 1).join('/')}`}>

            {routeLabels[seg] ?? seg}

          </Link>

        ),

    })),

  ];



  return <Breadcrumb items={items} className="mb-4" />;

}


