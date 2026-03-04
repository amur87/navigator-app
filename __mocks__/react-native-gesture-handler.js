const React = require('react');
const { View } = require('react-native');

const GestureHandlerRootView = ({ children, ...props }) => React.createElement(View, props, children);

module.exports = {
    GestureHandlerRootView,
};
