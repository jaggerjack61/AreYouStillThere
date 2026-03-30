import { useEffect, useState } from 'react';

import { servicesAPI } from '../../api';

export default function useRequestLogServices() {
  const [services, setServices] = useState([]);

  useEffect(() => {
    let active = true;

    servicesAPI.list().then(({ data }) => {
      if (!active) return;
      setServices(data.results || data);
    });

    return () => {
      active = false;
    };
  }, []);

  return services;
}