require('@testing-library/jest-dom');

globalThis.__APP_CONFIG__ = {
  apiUrl: '/api',
};

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

function joinConsoleArgs(args) {
  return args
    .map((value) => {
      if (typeof value === 'string') {
        return value;
      }

      if (value instanceof Error) {
        return value.message;
      }

      try {
        return JSON.stringify(value);
      } catch (error) {
        return String(value);
      }
    })
    .join(' ');
}

function hasArgFragment(args, fragment) {
  return args.some((value) => typeof value === 'string' && value.includes(fragment));
}

function isKnownTestNoise(args) {
  const message = joinConsoleArgs(args);
  const isLegacyActDeprecation =
    (message.includes('ReactDOMTestUtils.act') || hasArgFragment(args, 'ReactDOMTestUtils.act')) &&
    (
      message.includes('deprecated in favor of') ||
      hasArgFragment(args, 'deprecated in favor of') ||
      message.includes('react-dom/test-utils') ||
      hasArgFragment(args, 'react-dom/test-utils')
    );

  return (
    isLegacyActDeprecation ||
    message.includes('inside a test was not wrapped in act(...)') ||
    message.includes('React Router Future Flag Warning:')
  );
}

console.error = (...args) => {
  if (isKnownTestNoise(args)) {
    return;
  }

  originalConsoleError(...args);
};

console.warn = (...args) => {
  if (isKnownTestNoise(args)) {
    return;
  }

  originalConsoleWarn(...args);
};
