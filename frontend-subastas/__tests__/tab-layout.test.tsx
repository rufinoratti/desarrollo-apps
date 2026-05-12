jest.mock('expo-router', () => ({
  Tabs: Object.assign(
    ({ children }: any) => {
      const React = jest.requireActual('react');
      const { View } = jest.requireActual('react-native');
      return React.createElement(View, { testID: 'tabs-container' }, children);
    },
    {
      Screen: ({ children }: any) => {
        const React = jest.requireActual('react');
        return React.createElement(React.Fragment, null, children);
      },
    }
  ),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

import { render } from '@testing-library/react-native';
import TabLayout from '../app/(tabs)/_layout';

describe('TabLayout', () => {
  it('renderiza correctamente', () => {
    const { getByTestId } = render(<TabLayout />);
    expect(getByTestId('tabs-container')).toBeTruthy();
  });
});
