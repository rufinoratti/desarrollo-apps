import React, { createContext, useContext, useState, ReactNode } from 'react';

interface RegistrationData {
  registro_id?: number | null;
  paso1?: {
    nombre_completo: string;
    documento: string;
    direccion: string;
    pais_residencia: number | null;
    email: string;
  };
}

interface RegistrationContextData {
  registrationData: RegistrationData;
  updateRegistrationData: (data: Partial<RegistrationData>) => void;
  clearRegistrationData: () => void;
}

const RegistrationContext = createContext<RegistrationContextData>({} as RegistrationContextData);

export const RegistrationProvider = ({ children }: { children: ReactNode }) => {
  const [registrationData, setRegistrationData] = useState<RegistrationData>({});

  const updateRegistrationData = (data: Partial<RegistrationData>) => {
    setRegistrationData((prev) => ({ ...prev, ...data }));
  };

  const clearRegistrationData = () => {
    setRegistrationData({});
  };

  return (
    <RegistrationContext.Provider value={{ registrationData, updateRegistrationData, clearRegistrationData }}>
      {children}
    </RegistrationContext.Provider>
  );
};

export const useRegistration = () => useContext(RegistrationContext);
