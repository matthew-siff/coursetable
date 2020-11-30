import React from 'react';
import { useTheme } from 'styled-components';
import { FaRegMoon } from 'react-icons/fa';
import { ImSun } from 'react-icons/im';
import styled from 'styled-components';

const StyledBtn = styled.span`
  color: ${({ theme }) => theme.text[1]};
  transition: color 0.1s;
  &:hover {
    cursor: pointer;
    color: ${({ theme }) => theme.primary};
  }
`;

/**
 * DarkMode Button
 */
const DarkModeButton: React.VFC<{}> = () => {
  const theme = useTheme();
  return (
    <StyledBtn className="my-auto">
      {theme.theme === 'dark' ? (
        <ImSun size={20} style={{ display: 'block' }} />
      ) : (
        <FaRegMoon size={20} style={{ display: 'block' }} />
      )}
    </StyledBtn>
  );
};

export default DarkModeButton;