import { Center, chakra, Group, Input, Button, Flex } from '@chakra-ui/react';
import React, { useState } from 'react';
import './fonts.css';
import './test.css';
import background from './background.png';


function MyForm() {
  const [inputValue, setInputValue] = useState('');

  const handleChange = (event) => {
    setInputValue(event.target.value);
  };

  const handleNavigation = () => {
    window.location.href = `https://magiccircle.gg/r/${inputValue}`; // Replace with your target URL
  };

  return (
    <Group display="flex" flexDirection="column" textAlign="center">
      <p style={{fontWeight:"700",
           maxWidth:"90vh",
           fontSize:"30px",
           lineHeight:"1.2",
           fontFamily:"greycliff-cf", color:"white"}}>
      We're sorry! That room is full! <br/> Spectating is disabled right now, so let's join a new room!
    </p>
      <Group display="flex" flexDirection="column" max-width="600px">

      <Input
        placeholder="Room Code"
        _placeholder={{ color: '#8c8c8c', letterSpacing: '0px' }}
        bg="rgb(64, 64, 64)"
        color="rgb(245, 245, 245)"
        py="2"
        px="4"
        rounded="6px"
        fontWeight="700"
        textTransform="uppercase"
        minWidth="0px"
        fontSize="md"
        lineHeight="1.2"
        fontFamily="greycliff-cf"
        paddingInline="24px"
        paddingTop="10px"
        paddingBottom="10px"
        display="inline-flex"
        outline="transparent"
        border="transparent"
        letterSpacing="10px"
        textAlign="center"
        outlineOffset="2px"
        height="auto"
        transitionProperty="background-color,border-color,color,fill,stroke,opacity,box-shadow,transform"
        transitionDuration="200ms"
        _focusVisible={{ boxShadow: 'white 0px 0px 0px 2px inset' }}
        value={inputValue}
        onChange={handleChange}
      />
      <Button
        bg="#5EB292"
        color="#F5F5F5"
        py="2"
        px="4"
        rounded="50px"
        fontWeight="700"
        textTransform="uppercase"
        maxWidth="100%"
        fontSize="md"
        lineHeight="1.2"
        fontFamily="greycliff-cf"
        paddingInline="24px"
        paddingTop="12px"
        paddingBottom="12px"
        display="inline-flex"
        verticalAlign="middle"
        whiteSpace="nowrap"
        position="relative"
        textAlign="center"
        alignItems="center"
        justifyContent="center"
        transitionProperty="background-color,border-color,color,fill,stroke,opacity,box-shadow,transform"
        transitionDuration="200ms"
        appearance="none"
        cursor="pointer"
        onClick={handleNavigation}
      >
        Join
      </Button>
    </Group></Group>
  );
}

/*
const Input = ({ children }) => (
  <chakra.input
    bg="rgb(64, 64, 64)"
    color="rgb(245, 245, 245)"
    py="2"
    px="4"
    rounded="6px"
    fontWeight="700"
    textTransform="uppercase"
    minWidth="0px"
    fontSize="md"
    lineHeight="1.2"
    fontFamily="greycliff-cf"
    paddingInline="24px"
    paddingTop="10px"
    paddingBottom="10px"
    display="inline-flex"
    outline="transparent solid 2px"
  >
    {children}
  </chakra.input>
);*/



function ErrorPage() {

  return (
      <Flex
        bgImage={`url(${background})`}
        width="100vw"
        height="100vh"
        alignItems="center"
        justifyContent="center"
      >

        <MyForm></MyForm>
      </Flex>

  );
}

export default ErrorPage;