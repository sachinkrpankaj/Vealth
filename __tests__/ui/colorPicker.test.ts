import { colorFieldSelection, hexToHsv, hsvToHex, hueSliderSelection, normalizeHexColor } from '../../src/utils/colorPicker';

describe('visual color selection', () => {
  it.each([240, 280, 320, 375, 412])('uses measured field dimensions at width %i', (width) => {
    const color = colorFieldSelection({ h: 120, s: 1, v: 1 }, width / 2, 42, width, 168);
    expect(color).toEqual({ h: 120, s: 0.5, v: 0.75 });
    expect(hsvToHex(color.h, color.s, color.v)).toBe('#60BF60');
  });

  it('keeps selection inside the color field when a finger moves beyond an edge', () => {
    expect(colorFieldSelection({ h: 30, s: 0.5, v: 0.5 }, -20, -20, 300, 168)).toEqual({ h: 30, s: 0, v: 1 });
    expect(colorFieldSelection({ h: 30, s: 0.5, v: 0.5 }, 350, 200, 300, 168)).toEqual({ h: 30, s: 1, v: 0 });
  });

  it('retains the right hue endpoint without jumping the thumb to the left', () => {
    const hsv = hueSliderSelection({ h: 0, s: 1, v: 1 }, 400, 300);
    expect(hsv.h).toBe(360);
    expect(hsvToHex(hsv.h, hsv.s, hsv.v)).toBe('#FF0000');
    expect(hueSliderSelection(hsv, 150, 300).h).toBe(180);
  });

  it('ignores touches before the native view has been measured', () => {
    const initial = { h: 180, s: 0.5, v: 0.5 };
    expect(colorFieldSelection(initial, 20, 30, 0, 0)).toEqual(initial);
    expect(hueSliderSelection(initial, 20, 0)).toEqual(initial);
  });

  it.each(['#3B82F6', '#123456', '#FFFFFF', '#000000', '#818CF8', '#FF0000'])('preserves exact HEX %s across visual editing', (hex) => {
    const hsv = hexToHsv(hex);
    expect(hsvToHex(hsv.h, hsv.s, hsv.v)).toBe(hex);
  });

  it('accepts only complete three or six digit HEX values', () => {
    expect(normalizeHexColor(' abc ')).toBe('#AABBCC');
    expect(normalizeHexColor('#ab12ef')).toBe('#AB12EF');
    expect(normalizeHexColor('12zzzz')).toBeNull();
    expect(normalizeHexColor('#12345')).toBeNull();
    expect(normalizeHexColor('#12345678')).toBeNull();
  });
});
