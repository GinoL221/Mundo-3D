import logo from './logo.svg';
import './App.css';
import "./assets/css/app.css"
import ContentRowTopMovies from './components/ContentRowMovies';
import Sidebar from "./components/SideBar"
import TopBar from "./components/TopBar"
import ContentRowTop from "./components/ContentRowTop"
import SideBar from './components/SideBar';
import Footer from "./components/Footer"
import ContentWrapper from "./components/ContentWrapper"
import {BrowserRouter, Link, Route } from "react-router-dom"

import ProductList from './components/ProductList';
import CategoryList from './components/CategoryList';
import LatestProduct from './components/LastestProduct';



function App() {
  return (
    <div className="App">
      <header className="App-header">
    <div>
      <h2>Mundo-3D Dashboard</h2>
      <ContentWrapper/>
    </div>
      </header>
    </div>
  );
}

export default App;
