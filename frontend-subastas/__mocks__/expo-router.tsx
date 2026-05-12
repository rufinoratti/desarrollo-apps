const React = jest.requireActual('react');
const { View } = jest.requireActual('react-native');

function Tabs({ children, ...props }: any) {
  return React.createElement(View, { testID: 'tabs-container' }, children);
}

Tabs.Screen = function Screen() {
  return null;
};

exports.Tabs = Tabs;
exports.Stack = { Screen: () => null };
exports.router = { back: jest.fn(), push: jest.fn() };
exports.useLocalSearchParams = () => ({});
exports.useNavigation = () => ({ navigate: jest.fn() });
exports.SplashScreen = { preventAutoHideAsync: jest.fn() };
exports.Link = ({ children }: any) => React.createElement(View, null, children);

export {};
