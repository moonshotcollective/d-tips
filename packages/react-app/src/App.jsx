import WalletConnectProvider from "@walletconnect/web3-provider";
//import Torus from "@toruslabs/torus-embed"
import WalletLink from "walletlink";
import { Alert, Button, Menu, Select, Space, Switch as AntdSwitch } from "antd";
import "antd/dist/antd.css";
import React, { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Link, Route, Switch } from "react-router-dom";
import "./App.css";
import { Account, Contract } from "./components";
import { NETWORK, NETWORKS } from "./constants";
import { Transactor, Address as AddressHelper, Web3ModalSetup } from "./helpers";
import { useBalance, useContractLoader, useExchangePrice, useGasPrice, useOnBlock, useUserSigner } from "./hooks";
import { Rooms, Home } from "./views";
// Wallets for wallet connect
const { ethers } = require("ethers");

// 😬 Sorry for all the console logging
const DEBUG = false;
const NETWORKCHECK = true;

// Add more networks as the dapp expands to more networks
//const configuredNetworks = ["mainnet", "rinkeby", "xdai", "matic", "mainnetAvalanche"];
const configuredNetworks = ["matic", "rinkeby"];
if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
  configuredNetworks.push("localhost");
}

const cachedNetwork = window.localStorage.getItem("network");
if (DEBUG) console.log("📡 Connecting to New Cached Network: ", cachedNetwork);

/// 📡 What chain are your contracts deployed to?
//let targetNetwork = NETWORKS[cachedNetwork || "mainnet"];
let targetNetwork = NETWORKS[cachedNetwork || "rinkeby"]; // <------- select your target frontend network (localhost, rinkeby, xdai, mainnet)

// 🛰 providers
if (DEBUG) console.log(`Connecting to ${cachedNetwork || "mainnet"}`);
if (DEBUG) console.log(`Network info: ${targetNetwork}`);
// const mainnetProvider = getDefaultProvider("mainnet", { infura: INFURA_ID, etherscan: ETHERSCAN_KEY, quorum: 1 });
// const mainnetProvider = new InfuraProvider("mainnet",INFURA_ID);
//
// attempt to connect to our own scaffold eth rpc and if that fails fall back to infura...
// Using StaticJsonRpcProvider as the chainId won't change see https://github.com/ethers-io/ethers.js/issues/901
const scaffoldEthProvider = navigator.onLine
  ? new ethers.providers.StaticJsonRpcProvider("https://eth-mainnet.alchemyapi.io/v2/qCdzfF9UqXcJYIle-Ff-BN0MII8LjLQs")
  : null;
const poktMainnetProvider = navigator.onLine
  ? new ethers.providers.StaticJsonRpcProvider(
      "https://eth-mainnet.gateway.pokt.network/v1/lb/611156b4a585a20035148406",
    )
  : null;
const mainnetInfura = navigator.onLine
  ? new ethers.providers.StaticJsonRpcProvider("https://eth-mainnet.alchemyapi.io/v2/qCdzfF9UqXcJYIle-Ff-BN0MII8LjLQs")
  : null;
// ( ⚠️ Getting "failed to meet quorum" errors? Check your INFURA_I )

// as you deploy to other networks you can set REACT_APP_PROVIDER=https://dai.poa.network in packages/react-app/.env
const localProviderUrlFromEnv = targetNetwork.rpcUrl;
if (DEBUG) console.log("🏠 Connecting to provider:", localProviderUrlFromEnv);
const localProvider = new ethers.providers.StaticJsonRpcProvider(localProviderUrlFromEnv);

// 🔭 block explorer URL
const blockExplorer = targetNetwork.blockExplorer;

// Portis ID: 6255fb2b-58c8-433b-a2c9-62098c05ddc9
/*
  Web3 modal helps us "connect" external wallets:
*/
const web3Modal = Web3ModalSetup(targetNetwork);

function App(props) {
  const mainnetProvider =
    poktMainnetProvider && poktMainnetProvider._isProvider
      ? poktMainnetProvider
      : scaffoldEthProvider && scaffoldEthProvider._network
      ? scaffoldEthProvider
      : mainnetInfura;

  const [injectedProvider, setInjectedProvider] = useState();
  const [address, setAddress] = useState("0x0000000000000000000000000000000000000000");
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [isHost, setHost] = useState(false);

  const logoutOfWeb3Modal = async () => {
    await web3Modal.clearCachedProvider();
    if (injectedProvider && injectedProvider.provider && typeof injectedProvider.provider.disconnect == "function") {
      await injectedProvider.provider.disconnect();
    }
    setTimeout(() => {
      window.location.reload();
    }, 1);
  };

  /* 💵 This hook will get the price of ETH from 🦄 Uniswap: */
  const price = useExchangePrice(targetNetwork, mainnetProvider);

  /* 🔥 This hook will get the price of Gas from ⛽️ EtherGasStation */
  const gasPrice = useGasPrice(targetNetwork, "fast");

  // Use your injected provider from 🦊 Metamask or if you don't have it then instantly generate a 🔥 burner wallet.
  // we want to remove the burner wallet.
  const userSigner = useUserSigner(injectedProvider, localProvider, false);

  useEffect(() => {
    async function getAddress() {
      if (userSigner) {
        const newAddress = await userSigner.getAddress();
        setAddress(newAddress);
      }
    }
    getAddress();
  }, [userSigner]);

  // You can warn the user if you would like them to be on a specific network
  const localChainId = localProvider && localProvider._network && localProvider._network.chainId;
  const selectedChainId =
    userSigner && userSigner.provider && userSigner.provider._network && userSigner.provider._network.chainId;

  // For more hooks, check out 🔗eth-hooks at: https://www.npmjs.com/package/eth-hooks

  // The transactor wraps transactions and provides notificiations
  const tx = Transactor(userSigner, gasPrice);

  // Faucet Tx can be used to send funds from the faucet
  const faucetTx = Transactor(localProvider, gasPrice);

  // 🏗 scaffold-eth is full of handy hooks like this one to get your balance:
  const yourLocalBalance = useBalance(localProvider, address);

  // Just plug in different 🛰 providers to get your balance on different chains:
  const yourMainnetBalance = useBalance(mainnetProvider, address);

  // Load in your local 📝 contract and read a value from it:
  const readContracts = useContractLoader(localProvider);

  // If you want to make 🔐 write transactions to your contracts, use the userSigner:
  const writeContracts = useContractLoader(userSigner, { chainId: localChainId });

  const room = window.location.pathname.slice(6);

  // EXTERNAL CONTRACT EXAMPLE:
  //
  // If you want to bring in the mainnet DAI contract it would look like:
  const mainnetContracts = useContractLoader(mainnetProvider);

  // If you want to call a function on a new block
  useOnBlock(mainnetProvider, () => {
    console.log(`⛓ A new mainnet block is here: ${mainnetProvider._lastBlockNumber}`);
  });

  const appServer = process.env.REACT_APP_SERVER;

  /*
  const addressFromENS = useResolveName(mainnetProvider, "austingriffith.eth");
  console.log("🏷 Resolved austingriffith.eth as:",addressFromENS)
  */

  //
  // 🧫 DEBUG 👨🏻‍🔬
  //
  useEffect(() => {
    if (
      DEBUG &&
      mainnetProvider &&
      address &&
      selectedChainId &&
      yourLocalBalance &&
      yourMainnetBalance &&
      readContracts &&
      writeContracts &&
      mainnetContracts
    ) {
      console.log("_____________________________________ 🏗 scaffold-eth _____________________________________");
      console.log("🌎 mainnetProvider", mainnetProvider);
      console.log("🏠 localChainId", localChainId);
      console.log("👩‍💼 selected address:", address);
      console.log("🕵🏻‍♂️ selectedChainId:", selectedChainId);
      console.log("💵 yourLocalBalance", yourLocalBalance ? ethers.utils.formatEther(yourLocalBalance) : "...");
      console.log("💵 yourMainnetBalance", yourMainnetBalance ? ethers.utils.formatEther(yourMainnetBalance) : "...");
      console.log("📝 readContracts", readContracts);
      console.log("🌍 DAI contract on mainnet:", mainnetContracts);
      console.log("🔐 writeContracts", writeContracts);
    }

    if (readContracts) {
      setIsWalletConnected(AddressHelper.isValidAddress(address));
    }
  }, [
    mainnetProvider,
    address,
    selectedChainId,
    yourLocalBalance,
    yourMainnetBalance,
    readContracts,
    writeContracts,
    mainnetContracts,
  ]);

  let networkDisplay = "";
  if (NETWORKCHECK && localChainId && selectedChainId && localChainId !== selectedChainId) {
    const networkSelected = NETWORK(selectedChainId);
    const networkLocal = NETWORK(localChainId);
    if (selectedChainId === 1337 && localChainId === 31337) {
      networkDisplay = (
        <div style={{ zIndex: 2, position: "absolute", right: 0, top: 60, padding: 16 }}>
          <Alert
            message="⚠️ Wrong Network ID"
            description={
              <div>
                You have <b>chain id 1337</b> for localhost and you need to change it to <b>31337</b> to work with
                HardHat.
                <div>(MetaMask -&gt; Settings -&gt; Networks -&gt; Chain ID -&gt; 31337)</div>
              </div>
            }
            type="error"
            closable={false}
          />
        </div>
      );
    } else {
      networkDisplay = (
        <div style={{ zIndex: 2, position: "absolute", right: 0, top: 60, padding: 16 }}>
          <Alert
            message="⚠️ Wrong Network"
            description={
              <div>
                You have <b>{networkSelected && networkSelected.name}</b> selected and you need to be on{" "}
                <Button
                  onClick={async () => {
                    const ethereum = window.ethereum;
                    const data = [
                      {
                        chainId: "0x" + targetNetwork.chainId.toString(16),
                        chainName: targetNetwork.name,
                        nativeCurrency: targetNetwork.nativeCurrency,
                        rpcUrls: [targetNetwork.rpcUrl],
                        blockExplorerUrls: [targetNetwork.blockExplorer],
                      },
                    ];
                    console.log("data", data);
                    // try to add new chain
                    try {
                      await ethereum.request({ method: "wallet_addEthereumChain", params: data });
                    } catch (error) {
                      // if failed, try a network switch instead
                      await ethereum
                        .request({
                          method: "wallet_switchEthereumChain",
                          params: [
                            {
                              chainId: "0x" + targetNetwork.chainId.toString(16),
                            },
                          ],
                        })
                        .catch();
                      if (tx) {
                        console.log(tx);
                      }
                    }
                  }}
                >
                  <b>{networkLocal && networkLocal.name}</b>
                </Button>
                .
              </div>
            }
            type="error"
            closable={false}
          />
        </div>
      );
    }
  } else {
    networkDisplay = <span></span>;
  }

  const options = [];
  for (const id in NETWORKS) {
    if (configuredNetworks.indexOf(id) > -1) {
      options.push(
        <Select.Option key={id} value={NETWORKS[id].name}>
          <span style={{ color: NETWORKS[id].color, fontSize: 20 }}>{NETWORKS[id].name}</span>
        </Select.Option>,
      );
    }
  }

  const networkSelect = (
    <Select
      size="large"
      defaultValue={targetNetwork.name}
      style={{ textAlign: "left", width: 140, fontSize: 30 }}
      onChange={value => {
        if (targetNetwork.chainId !== NETWORKS[value].chainId) {
          window.localStorage.setItem("network", value);
          setTimeout(async () => {
            targetNetwork = NETWORKS[value];
            const ethereum = window.ethereum;
            const data = [
              {
                chainId: "0x" + targetNetwork.chainId.toString(16),
                chainName: targetNetwork.name,
                nativeCurrency: targetNetwork.nativeCurrency,
                rpcUrls: [targetNetwork.rpcUrl],
                blockExplorerUrls: [targetNetwork.blockExplorer],
              },
            ];
            console.log("data", data);
            // try to add new chain
            try {
              await ethereum.request({ method: "wallet_addEthereumChain", params: data });
            } catch (error) {
              // if failed, try a network switch instead
              await ethereum
                .request({
                  method: "wallet_switchEthereumChain",
                  params: [
                    {
                      chainId: "0x" + targetNetwork.chainId.toString(16),
                    },
                  ],
                })
                .catch();
              if (tx) {
                console.log(tx);
              }
            }
            window.location.reload();
          }, 1000);
        }
      }}
    >
      {options}
    </Select>
  );

  const loadWeb3Modal = useCallback(async () => {
    const provider = await web3Modal.requestProvider();
    setInjectedProvider(new ethers.providers.Web3Provider(provider));

    provider.on("chainChanged", chainId => {
      console.log(`chain changed to ${chainId}! updating providers`);
      setInjectedProvider(new ethers.providers.Web3Provider(provider));
    });

    provider.on("accountsChanged", () => {
      console.log(`account changed!`);
      setInjectedProvider(new ethers.providers.Web3Provider(provider));
    });

    // Subscribe to session disconnection
    provider.on("disconnect", (code, reason) => {
      console.log(code, reason);
      logoutOfWeb3Modal();
    });
  }, [setInjectedProvider]);

  useEffect(() => {
    if (web3Modal.cachedProvider) {
      loadWeb3Modal();
    }
    console.log("Checking URLS: ", injectedProvider);
  }, [loadWeb3Modal]);

  const [route, setRoute] = useState();
  useEffect(() => {
    setRoute(window.location.pathname);
  }, [setRoute]);

  useEffect(() => {
    if (room) {
      const userType = localStorage.getItem(room + "userType");
      if (userType === "host") {
        setHost(true);
      }
    }
  }, [room]);

  const toggleHost = () => {
    localStorage.setItem(room + "userType", isHost ? "guest" : "host");
    setHost(!isHost);
  };

  let faucetHint = "";
  const faucetAvailable = localProvider && localProvider.connection && targetNetwork.name.indexOf("local") !== -1;

  const [faucetClicked, setFaucetClicked] = useState(false);
  if (
    !faucetClicked &&
    localProvider &&
    localProvider._network &&
    localProvider._network.chainId === 31337 &&
    yourLocalBalance &&
    ethers.utils.formatEther(yourLocalBalance) <= 0
  ) {
    faucetHint = (
      <div>
        <Button
          type="primary"
          onClick={() => {
            faucetTx({
              to: address,
              value: ethers.utils.parseEther("0.01"),
            });
            setFaucetClicked(true);
          }}
        >
          💰 Grab funds from the faucet ⛽️
        </Button>
      </div>
    );
  }

  return (
    <div className="App pb-20">
      <div className="p-10 mx-auto flex flex-wrap">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex title-font font-medium items-center text-gray-900 mb-4 md:mb-0 navbar-title"
        >
          <div className="flex flex-col">
            <div className="flex flex-row text-2xl lg:text-5xl">
              Tip Party
              <svg width="56" height="55" viewBox="0 0 56 55" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M15.3726 43.8106C14.6263 44.1248 13.8338 43.4746 14.002 42.6859L18.787 20.2442C18.9433 19.5112 19.8254 19.2041 20.406 19.6805L36.8582 33.1796C37.4388 33.656 37.3035 34.5759 36.6099 34.8679L15.3726 43.8106Z"
                  stroke="#6F3FF5"
                  strokeWidth="4"
                />
                <path
                  d="M25.0475 4.63341C25.571 3.75631 26.9177 4.13128 26.9075 5.15128L26.8143 14.4007C26.8076 15.0587 26.1771 15.5322 25.5428 15.3556L20.8888 14.0598C20.2545 13.8832 19.9627 13.1528 20.3004 12.587L25.0475 4.63341Z"
                  fill="#FFCC00"
                />
                <path
                  d="M50.3606 23.8396C51.365 23.6408 51.989 24.896 51.2206 25.5694L44.2503 31.6777C43.7562 32.1107 42.9833 31.9576 42.6905 31.3687L40.5501 27.0637C40.2574 26.4748 40.6041 25.7708 41.2499 25.643L50.3606 23.8396Z"
                  fill="#FFCC00"
                />
                <path
                  d="M39.442 11.9061C40.3004 11.3494 41.3459 12.2803 40.8843 13.1904L36.6983 21.4448C36.4011 22.0309 35.6258 22.1769 35.1343 21.7393L31.5352 18.5344C31.0438 18.0968 31.1041 17.3142 31.6569 16.9557L39.442 11.9061Z"
                  fill="#FFCC00"
                />
              </svg>
            </div>

            <p className="navbar-subtitle text-base lg:text-2xl">by MOONSHOT COLLECTIVE</p>
          </div>
        </a>
        <span className="flex inline-flex sm:ml-auto sm:mt-0 flex-col lg:flex-row ml-2">
          {room && (
            <div className="flex flex-col px-7">
              <Space direction="vertical">
                <label className="text-base">Toggle Host:</label>
                <AntdSwitch checkedChildren="Host" unCheckedChildren="Guest" checked={isHost} onChange={toggleHost} />
                {/* <Button
                  size="large"
                  type="primary"
                  style={
                    isHost
                      ? { borderColor: "#4b3ff5", backgroundColor: "#4b3ff5" }
                      : { borderColor: "#6F3FF5", backgroundColor: "#6F3FF5" }
                  }
                  onClick={toggleHost}
                >
                  {" "}
                  {isHost ? "Sign in as Guest" : "Become a Host"}
                </Button> */}
              </Space>
            </div>
          )}
          <Account
            address={address}
            localProvider={localProvider}
            userSigner={userSigner}
            mainnetProvider={mainnetProvider}
            price={price}
            web3Modal={web3Modal}
            loadWeb3Modal={loadWeb3Modal}
            logoutOfWeb3Modal={logoutOfWeb3Modal}
            blockExplorer={blockExplorer}
            networkSelect={networkSelect}
            networkDisplay={networkDisplay}
          />
        </span>
      </div>
      <BrowserRouter>
        {targetNetwork.name === "localhost" && (
          <Menu style={{ textAlign: "center" }} selectedKeys={[route]} mode="horizontal">
            <Menu.Item key="/">
              <Link
                onClick={() => {
                  setRoute("/");
                }}
                to="/"
              >
                App
              </Link>
            </Menu.Item>
            {targetNetwork.name === "localhost" && (
              <Menu.Item key="/contracts">
                <Link
                  onClick={() => {
                    setRoute("/contracts");
                  }}
                  to="/contracts"
                >
                  Contracts
                </Link>
              </Menu.Item>
            )}
          </Menu>
        )}

        <main>
          <Switch>
            <>
              <Route exact path="/">
                <Home
                  writeContracts={writeContracts}
                  readContracts={readContracts}
                  address={address}
                  mainnetProvider={mainnetProvider}
                  tx={tx}
                  isWalletConnected={isWalletConnected}
                  nativeCurrency={targetNetwork.nativeCurrency}
                />
              </Route>
              <Route path="/room/:room">
                <Rooms
                  address={address}
                  appServer={appServer}
                  web3Modal={web3Modal}
                  userSigner={userSigner}
                  mainnetProvider={mainnetProvider}
                  readContracts={readContracts}
                  writeContracts={writeContracts}
                  localProvider={localProvider}
                  yourLocalBalance={yourLocalBalance}
                  chainId={localChainId || selectedChainId}
                  selectedChainId={selectedChainId}
                  tx={tx}
                  nativeCurrency={targetNetwork.nativeCurrency}
                  isHost={isHost}
                  isWalletConnected={isWalletConnected}
                />
              </Route>
              <Route exact path="/contracts">
                <Contract
                  name="TokenDistributor"
                  signer={userSigner}
                  provider={localProvider}
                  address={address}
                  blockExplorer={blockExplorer}
                />
                <Contract
                  name="GTC"
                  signer={userSigner}
                  provider={localProvider}
                  address={address}
                  blockExplorer={blockExplorer}
                />
              </Route>
            </>
          </Switch>
        </main>
      </BrowserRouter>
      {/* 🗺 Extra UI like gas price, eth price, faucet, and support: */}
      {/* <div style={{ position: "fixed", textAlign: "left", left: 0, bottom: 20, padding: 10 }}>
        <Row align="middle" gutter={[4, 4]}>
          <Col span={12}>
            <Ramp price={price} address={address} networks={NETWORKS} />
          </Col>
          <Col span={12} style={{ textAlign: "center", opacity: 0.8 }}>
            <GasGauge gasPrice={gasPrice} />
          </Col>
          <Col span={8} style={{ textAlign: "center", opacity: 1 }}>
            <Button
              onClick={() => {
                window.open("https://t.me/joinchat/KByvmRe5wkR-8F_zz6AjpA");
              }}
              size="large"
              shape="round"
            >
              <span style={{ marginRight: 8 }} role="img" aria-label="support">
                💬
              </span>
              Support
            </Button>
          </Col> 
        </Row>
        <Row align="middle" gutter={[4, 4]}>
          <Col span={24}>
            {faucetAvailable ? (
              <Faucet localProvider={localProvider} price={price} ensProvider={mainnetProvider} />
            ) : (
                ""
              )}
          </Col>
        </Row>
      </div> */}
      {/* <Menu
            mode="inline"
            openKeys={openKeys}
          onOpenChange={keys => {
          setOpenKeys(openKeys ? keys : []);
        }}
          style={{ marginTop: "10px", border: "1px solid" }}
          onClick={e => {
          setMenuTitle(e.key);
          setOpenKeys([]);
        }}
      >
      <SubMenu key="sub1" title={menuTitle}>
        <Menu.Item key="GTC">GTC</Menu.Item>
        <Menu.Item key="DAI">DAI</Menu.Item>
        <Menu.Item key="USDC">USDC</Menu.Item>
      </SubMenu>
    </Menu> */}
    </div>
  );
}

export default App;
