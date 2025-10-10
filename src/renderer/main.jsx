import { ChakraProvider, defaultSystem } from "@chakra-ui/react"
import React from "react"
import ReactDOM from "react-dom/client"
import ErrorPage from "./ErrorPage"

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ChakraProvider value={defaultSystem}>
        <ErrorPage />
    </ChakraProvider>
  </React.StrictMode>,
)