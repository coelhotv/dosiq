// SmokeScreen.test.jsx — verifica que a tela renderiza sem crash
import { render } from '@testing-library/react-native'
import SmokeScreen from '../src/screens/SmokeScreen'

const mockNavigation = { navigate: jest.fn(), replace: jest.fn() }

describe('SmokeScreen', () => {
  it('renderiza sem crash', () => {
    const { getByText } = render(<SmokeScreen navigation={mockNavigation} />)
    expect(getByText('Smoke Test — Core Schema')).toBeTruthy()
  })
})
