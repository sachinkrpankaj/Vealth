import React from 'react';

const mockComponent = (name: string) => {
  const Component = (props: any) => React.createElement(name, props, props.children);
  Component.displayName = name;
  return Component;
};

export const Svg = mockComponent('Svg');
export const Path = mockComponent('Path');
export const Rect = mockComponent('Rect');
export const Circle = mockComponent('Circle');
export const G = mockComponent('G');
export const Text = mockComponent('Text');
export const Defs = mockComponent('Defs');
export const LinearGradient = mockComponent('LinearGradient');
export const RadialGradient = mockComponent('RadialGradient');
export const Stop = mockComponent('Stop');
export const Line = mockComponent('Line');

export default Svg;
