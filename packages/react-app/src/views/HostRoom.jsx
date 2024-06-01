import React, { useEffect, useState, useRef } from "react";
import { Button, List, notification, Card, Input, Collapse, Tabs, Menu, Dropdown, Popover, Tag, Divider } from "antd";
import { CloseOutlined, ExportOutlined, InfoCircleOutlined, LinkOutlined, PlusCircleOutlined } from "@ant-design/icons";
import { Address, PayButton, TransactionHash, AddressModal, TokenModal, TokenList } from "../components";
import { useParams } from "react-router-dom";
import { ethers } from "ethers";
import { CSVLink } from "react-csv";
import copy from "copy-to-clipboard";
import * as storage from "../utils/storage";
import { useTokenImport, useLookupAddress } from "../hooks";
//import useWindowSize from 'react-use/lib/useWindowSize'
import Confetti from "react-confetti";
import { NETWORK } from "../constants";
import axios from "axios";
import "./HostRoom.css";
import { useMemo } from "react";
import { utils } from "ethers";

export default function HostRoom({
  appServer,
  web3Modal,
  address,
  userSigner,
  mainnetProvider,
  writeContracts: oldWriteContracts,
  readContracts: oldReadContracts,
  yourLocalBalance,
  localProvider,
  chainId,
  selectedChainId,
  tx,
  nativeCurrency,
  networkTokenList,
  isWalletConnected,
  loadWeb3Modal
}) {
  const { room } = useParams();

  const [amount, setAmount] = useState(0);
  const [token, setToken] = useState(nativeCurrency);
  const [spender, setSpender] = useState("");
  const [addresses, setAddresses] = useState([]);
  const [importedAddresses, setImportedAddresses] = useState([]);
  const [txHash, setTxHash] = useState([]);
  const [blocklist, setBlocklist] = useState([]);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [availableTokens, setAvailableTokens] = useState([]);
  const [importToken, setImportToken] = useState(false);
  const [importAddressModal, setImportAddressModal] = useState(false);
  const [numberOfConfettiPieces, setNumberOfConfettiPieces] = useState(0);
  const [contracts, loadContracts, addContracts] = useTokenImport(localProvider, userSigner);
  const allAddresses = useMemo(() => [...addresses, ...importedAddresses], [addresses, importedAddresses]);
  const [loadedTokenList, setLoadedTokenList] = useState({});
  const [list, setList] = useState([]);
  const [tokenImportLoading, setTokenImportLoading] = useState(false);
  const [addressImportLoading, setAddressImportLoading] = useState(false);
  const [ensFilterLoading, setEnsFilterLoading] = useState(false);

  const { readContracts, writeContracts } = contracts;
  const numericalAmount = amount[0] === "." ? "0" + amount : amount;
  const explorer = chainId ? NETWORK(chainId).blockExplorer : `https://etherscan.io/`;

  const subs = useRef([]);

  //removed current user to top for host room since that introduces many bugs

  // useEffect(() => {
  //   // moving current user to the top of the list
  //   if (allAddresses && allAddresses.length > 0) {
  //     console.log('address:', address)
  //     const newAddresses = [...allAddresses];
  //     newAddresses.forEach((add, index) => {
  //       if (add.toLowerCase() === address.toLowerCase()) {
  //         newAddresses.splice(index, 1);
  //         newAddresses.unshift(add);
  //       }
  //     });
  //     setSortedAddresses(newAddresses);
  //   }
  // }, [address, allAddresses]);

  useEffect(() => {
    if (oldWriteContracts?.TokenDistributor) {
      setSpender(oldWriteContracts?.TokenDistributor?.address);
      addContracts({ writeContracts: oldWriteContracts, readContracts: oldReadContracts });
    }
  }, [oldWriteContracts]);

  useEffect(() => {
    if (addresses.includes(address.toLowerCase())) {
      setIsSignedIn(true);
    }
  }, [addresses, address]);

  useEffect(() => {
    //Import addresses from local storage
    const imports = localStorage.getItem(room);
    if (imports) {
      const parsedImports = JSON.parse(imports);
      setImportedAddresses(parsedImports);
    }
    const blocklistInStorage = localStorage.getItem(room + "blocklist");
    if (blocklistInStorage) {
      const parsedBlocklist = JSON.parse(blocklistInStorage);
      setBlocklist(parsedBlocklist);
    }
  }, [room]);

  useEffect(() => {
    //Import tokens from local storage
    const importLocalStorageTokens = localStorage.getItem(`${chainId}+token`);
    if (importLocalStorageTokens) {
      const parsedImports = JSON.parse(importLocalStorageTokens);
      setLoadedTokenList(parsedImports);
    }
  }, [chainId]);

  useEffect(() => {
    // clear existing subscriptions
    subs.current.map(sub => sub());

    // start new subscriptions
    if (chainId) {
      subs.current.push(storage.watchRoom(room, handleListUpdate));
      subs.current.push(storage.watchRoomTx(room, chainId, handleTransactionUpdate));
    }
  }, [room, chainId]);

  const amountChangeHandler = e => {
    // clean validation for only numbers (including decimal numbers): https://stackoverflow.com/a/43067857
    const re = /^\d*\.?\d*$/;

    if (e.target.value === "" || re.test(e.target.value)) {
      setAmount(e.target.value);
    }
  };

  const handleTokenImport = async tokenAddress => {
    const tokenSymbol = await loadContracts(tokenAddress);
    if (availableTokens.includes(tokenSymbol)) {
      setToken(tokenSymbol);
    } else if (tokenSymbol) {
      setToken(tokenSymbol);
      const temp = {};
      temp[tokenSymbol] = { tokenAddress };
      localStorage.setItem(`${chainId}+token`, JSON.stringify({ ...loadedTokenList, ...temp }));
      setImportToken(false);
      notification.success({
        message: "The ERC20 Token has been added",
        placement: "topRight",
      });
    } else {
      notification.error({
        message: "This ERC20 Address is not Valid",
        placement: "topRight",
      });
    }
  };

  const handleAddressImport = async addressesToImport => {
    //sets loading state when handling address imports
    setAddressImportLoading(true);

    //removes all of the spaces
    const str = addressesToImport.replace(/\s/g, "");

    //Splits the string into an array of addresses
    let arr = str.split(",");

    // Check if more than max capacity addresses are being imported
    if (arr.length + allAddresses.length >= 256) {
      setAddressImportLoading(false);
      return notification.error({
        message: "Failed to Add Addresses",
        description: "Room is at capacity!",
        placement: "bottomRight",
      });
    }

    //loop through each element in array
    for (let index = 0; index < arr.length; index++) {
      const element = arr[index];
      if (!ethers.utils.isAddress(element)) {
        try {
          let addr = await mainnetProvider.resolveName(element);
          addr = addr.toLowerCase();
          if (addr) {
            if (allAddresses.includes(addr)) {
              setAddressImportLoading(false);
              return notification.error({
                message: "Failed to Add Address",
                description: element + " is already included!",
                placement: "bottomRight",
              });
            }
            //changes ens in the array to address
            arr[index] = addr;
          }
          //error if ens is not address
          else {
            throw "error";
          }
        } catch (e) {
          setAddressImportLoading(false);
          return notification.error({
            message: "Failed to Add Address",
            description: element + " is not a valid Ethereum address",
            placement: "bottomRight",
          });
        }
      }
      if (allAddresses.includes(element)) {
        setAddressImportLoading(false);
        return notification.error({
          message: "Failed to Add Address",
          description: element + " is already included!",
          placement: "bottomRight",
        });
      }
    }

    // sets the addresses to local storage + changes the state
    Promise.all(arr).then(arr => {
      localStorage.setItem(room, JSON.stringify([...importedAddresses, ...arr]));
      setAddressImportLoading(false);
      setImportedAddresses([...importedAddresses, ...arr]);
      setImportAddressModal(false);

      return notification.success({
        message: "Successfully Added Addresses",
        placement: "bottomRight",
      });
    });
  };

  const handleConfetti = e => {
    setNumberOfConfettiPieces(400);
    setTimeout(() => {
      setNumberOfConfettiPieces(0);
    }, 4000);
  };

  const handleListUpdate = list => {
    const updatedList = new Set([...addresses, ...list]);

    //removes addresses that are in blocklist
    const blocklistInStorage = localStorage.getItem(room + "blocklist");
    if (blocklistInStorage && updatedList) {
      const parsedBlocklist = JSON.parse(blocklistInStorage);
      updatedList.forEach(addr => {
        if (parsedBlocklist.includes(addr.toLowerCase())) {
          updatedList.delete(addr);
        }
      });
    }

    // update addresses list
    setAddresses([...updatedList]);
  };

  const handleTransactionUpdate = newTx => {
    const update = new Set([...newTx, ...txHash]);
    setTxHash([...update]);
  };

  const ethPayHandler = async () => {
    if (chainId !== selectedChainId) {
      setAmount(0);
      return notification.error({
        message: "Networks do not match, please try again",
        placement: "topRight",
      });
    }
    const result = tx(
      writeContracts.TokenDistributor.splitEth(allAddresses, room, {
        value: ethers.utils.parseEther(numericalAmount),
      }),
      async update => {
        await handleResponseHash(update);
        console.log("📡 Transaction Update:", update);
        if (update && (update.status === "confirmed" || update.status === 1)) {
          console.log(" 🍾 Transaction " + update.hash + " finished!");
          console.log(
            " ⛽️ " +
              update.gasUsed +
              "/" +
              (update.gasLimit || update.gas) +
              " @ " +
              parseFloat(update.gasPrice) / 1000000000 +
              " gwei",
          );
          notification.success({
            message: "Payout successful",
            description: (
              <div>
                <p>
                  Each user received {numericalAmount / allAddresses.length} {token}
                </p>
                <p>
                  Transaction link:{" "}
                  <a target="_blank" href={`${explorer}tx/${update.hash}`} rel="noopener noreferrer">
                    {update.hash.substr(0, 20)}
                  </a>
                </p>
              </div>
            ),
            placement: "topRight",
          });
          handleConfetti();
        }
      },
    );
    console.log("awaiting metamask/web3 confirm result...", result);
    console.log(await result);
    setAmount(0);
  };

  const tokenPayHandler = async opts => {
    if (chainId !== selectedChainId) {
      setAmount(0);
      return notification.error({
        message: "Networks do not match, please try again",
        placement: "topRight",
      });
    }
    const result = tx(
      writeContracts.TokenDistributor.splitTokenFromUser(
        allAddresses,
        ethers.utils.parseUnits(numericalAmount, opts.decimals),
        opts.address,
        room,
      ),
      async update => {
        await handleResponseHash(update);
        console.log("📡 Transaction Update:", update);
        if (update && (update.status === "confirmed" || update.status === 1)) {
          console.log(" 🍾 Transaction " + update.hash + " finished!");
          console.log(
            " ⛽️ " +
              update.gasUsed +
              "/" +
              (update.gasLimit || update.gas) +
              " @ " +
              parseFloat(update.gasPrice) / 1000000000 +
              " gwei",
          );
          notification.success({
            message: "Payout successful",
            description: (
              <div>
                <p>
                  Each user received {numericalAmount / allAddresses.length} {token}
                </p>
                <p>
                  Transaction link:{" "}
                  <a target="_blank" href={`${explorer}tx/${update.hash}`} rel="noopener noreferrer">
                    {update.hash.substr(0, 20)}
                  </a>
                </p>
              </div>
            ),
            placement: "topRight",
          });
          handleConfetti();
        }
      },
    );
    console.log("awaiting metamask/web3 confirm result...", result);
    console.log(await result);
    setAmount(0);
  };

  const handleResponseHash = async result => {
    if (result.hash && selectedChainId && room) {
      await storage.registerTransactionForRoom(room, result.hash, selectedChainId);
    }
  };

  const reList = index => {
    const addressChanged = blocklist[index];
    const updatedAddressesList = [...blocklist];
    updatedAddressesList.splice(index, 1);
    setBlocklist([...updatedAddressesList]);
    localStorage.setItem(room + "blocklist", JSON.stringify([...updatedAddressesList]));
    setAddresses([...addresses, addressChanged]);
  };

  const unList = index => {
    const addressChanged = addresses[index];
    const updatedAddressesList = [...addresses];
    updatedAddressesList.splice(index, 1);
    setAddresses([...updatedAddressesList]);
    localStorage.setItem(room + "blocklist", JSON.stringify([...blocklist, addressChanged]));
    setBlocklist([...blocklist, addressChanged]);
  };
  const removeImportedAddress = index => {
    const updatedImportList = [...importedAddresses];
    updatedImportList.splice(index, 1);
    setImportedAddresses([...updatedImportList]);
    localStorage.setItem(room, JSON.stringify([...updatedImportList]));
  };

  const copyToClipBoard = () => {
    copy(allAddresses, {
      debug: true,
      message: "Copied List to ClipBoard",
    });
    notification.success({
      message: "Copied List To ClipBoard",
      placement: "bottomRight",
    });
  };

  const filterEns = async () => {
    setEnsFilterLoading(true);
    let blocklistAdded = [];
    

    for (let i = 0; i < addresses.length; i++) {
      const addr = addresses[i];
      const reportedName = await mainnetProvider.lookupAddress(addr);

      //const resolvedAddress =  await mainnetProvider.resolveName(reportedName);

      if (!reportedName) {
        //updatedAddressList.splice(i, 1);
        blocklistAdded.push(addr);
      }
    }
    const updatedAddressList = addresses.filter(addr =>  !blocklistAdded.includes(addr));

    setAddresses([...updatedAddressList]);
    setBlocklist([...blocklist, ...blocklistAdded]);
    localStorage.setItem(room + "blocklist", JSON.stringify([...blocklist, ...blocklistAdded]));
    setEnsFilterLoading(false);

    return notification.success({
      message: "Non-ENS Names successfully filtered out",
      placement: "topRight",
    });
  };

  const exportMenu = (
    <Menu>
      <Menu.Item key="export_csv">
        <CSVLink data={allAddresses.toString()} filename={`tip-party-addresses-${Date.now()}.csv`}>
          Export CSV
        </CSVLink>
      </Menu.Item>
      <Menu.Item key="copy_to_clipboard">
        <a target="_blank" onClick={copyToClipBoard}>
          Copy to Clipboard
        </a>
      </Menu.Item>
    </Menu>
  );

  return (
    <div className="bg-purple-darkpurple justify-center">
      <h2 id="title">Tip Your Party!</h2>
      <h3>
        You are a <b>Host</b> for "<b>{room}</b>" room{" "}
        <Button
          type="primary"
          size="small"
          onClick={() => {
            try {
              const el = document.createElement("input");
              el.value = window.location.href;
              document.body.appendChild(el);
              el.select();
              document.execCommand("copy");
              document.body.removeChild(el);
              return notification.success({
                message: "Invite link copied to clipboard",
                placement: "topRight",
              });
            } catch (err) {
              return notification.success({
                message: "Failed to copy invite link to clipboard",
                placement: "topRight",
              });
            }
          }}
        >
          Invite{" "}
          <LinkOutlined
            style={{
              display: "inline-block",
              verticalAlign: "middle",
            }}
          />
        </Button>
      </h3>
      <div
        className="Room"
        style={{
          margin: "20px auto",
          marginBottom: 30,
          width: 500,
          padding: 20,
          paddingBottom: 40,
        }}
      >
        <Confetti
          recycle={true}
          run={true}
          height={document.body.scrollHeight}
          confettiSource={{ x: 0, y: 0, w: document.body.scrollWidth, h: window.scrollY }}
          numberOfPieces={numberOfConfettiPieces}
          tweenDuration={3000}
        />
        <div>
          <Tabs defaultActiveKey="1" centered>
            <Tabs.TabPane tab="Room" key="1">
              <div>
                <AddressModal
                  visible={importAddressModal}
                  handleAddress={handleAddressImport}
                  onCancel={() => {
                    setImportAddressModal(false);
                    setAddressImportLoading(false);
                  }}
                  okText="Submit"
                  confirmLoading={addressImportLoading}
                />
                <div style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
                  <Button
                    size="small"
                    loading={ensFilterLoading}
                    onClick={async () => {
                      await filterEns();
                    }}
                  >
                    Remove Non-ENS Addresses
                  </Button>
                </div>
                <div style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
                  <a
                    href="#"
                    onClick={e => {
                      e.preventDefault();
                      setImportAddressModal(true);
                    }}
                  >
                    Import Address +
                  </a>
                </div>

                <div style={{ flex: 1 }}>
                  <Collapse defaultActiveKey={["1"]}>
                    <Collapse.Panel
                      header={`Pay List - ${allAddresses.length}`}
                      key="1"
                      extra={
                        <div onClick={e => e.stopPropagation()}>
                          <Dropdown overlay={exportMenu} placement="bottomRight" arrow trigger="hover">
                            <ExportOutlined />
                          </Dropdown>
                        </div>
                      }
                    >
                      {allAddresses.length === 0 && <h2>This room is currently empty </h2>}
                      {allAddresses.length > 0 && (
                        <List
                          bordered
                          dataSource={allAddresses}
                          renderItem={(item, index) => (
                            <List.Item key={`${item.toLowerCase()}-${index}`}>
                              <div
                                style={{
                                  width: "100%",
                                  flex: 1,
                                  display: "flex",
                                  flexDirection: "row",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <Address
                                  address={item}
                                  ensProvider={mainnetProvider}
                                  fontSize={28}
                                  userAddress={address.toLowerCase()}
                                />
                                {importedAddresses.includes(item) && <Tag color="grey">imported</Tag>}
                                <Button
                                  onClick={() => {
                                    if (importedAddresses.includes(item))
                                      removeImportedAddress(index - addresses.length);
                                    else unList(index);
                                  }}
                                  size="medium"
                                >
                                  <CloseOutlined />
                                </Button>
                              </div>
                            </List.Item>
                          )}
                        />
                      )}
                    </Collapse.Panel>
                    {blocklist.length > 0 && (
                      <Collapse.Panel
                        header="Blocklist"
                        key="2"
                        extra={
                          <Popover
                            title="Blocklist:"
                            content="Addresses in the blocklist are temporarily removed from the pay list and will not be included in the payout."
                          >
                            <InfoCircleOutlined />
                          </Popover>
                        }
                      >
                        <List
                          bordered
                          dataSource={blocklist}
                          renderItem={(item, index) => (
                            <List.Item>
                              <div
                                style={{
                                  width: "100%",
                                  flex: 1,
                                  display: "flex",
                                  flexDirection: "row",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <Address
                                  address={item}
                                  ensProvider={mainnetProvider}
                                  fontSize={28}
                                  userAddress={address.toLowerCase()}
                                />
                                <Button onClick={() => reList(index)} size="medium">
                                  <CloseOutlined />
                                </Button>
                              </div>
                            </List.Item>
                          )}
                        />
                      </Collapse.Panel>
                    )}
                  </Collapse>
                </div>

                <div style={{ width: "100%", display: "flex", margin: "10px auto" }}>
                  <div>
                    {/* TODO : disable input until ERC-20 token is selected */}
                    <Input
                      value={amount}
                      addonBefore="Total Amount to Distribute"
                      addonAfter={
                        <TokenList
                          token={token}
                          setToken={setToken}
                          readContracts={readContracts}
                          tokenListHandler={tokens => setAvailableTokens(tokens)}
                          nativeCurrency={nativeCurrency}
                          loadedTokenList={loadedTokenList}
                          availableTokens={availableTokens}
                        />
                      }
                      style={{ marginTop: "10px" }}
                      onChange={amountChangeHandler}
                    />

                    <TokenModal
                      destroyOnClose={true}
                      visible={importToken}
                      chainId={chainId}
                      onChange={handleTokenImport}
                      localProvider={localProvider}
                      networkTokenList={networkTokenList}
                      onCancel={() => setImportToken(false)}
                      okText="Import Token"
                      setImportToken={setImportToken}
                      list={list}
                    />

                    <div style={{ width: "100%", marginTop: 7, display: "flex", justifyContent: "flex-end" }}>
                      <Button
                        type="primary"
                        ghost
                        loading={tokenImportLoading}
                        icon={<div></div>}
                        onClick={async e => {
                          e.preventDefault();
                          if (networkTokenList) {
                            setTokenImportLoading(true);
                            const res = await axios.get(networkTokenList);
                            setTokenImportLoading(false);
                            const { tokens } = res.data;
                            setList(tokens);
                          } else {
                            setList([]);
                          }
                          setImportToken(true);
                        }}
                      >
                        Import ERC-20 Token
                      </Button>
                    </div>
                    {isWalletConnected ? (
                      <PayButton
                        style={{ marginTop: 20 }}
                        token={token}
                        appName="Tip.party"
                        callerAddress={address}
                        maxApproval={numericalAmount}
                        amount={numericalAmount}
                        spender={spender}
                        yourLocalBalance={yourLocalBalance}
                        readContracts={readContracts}
                        writeContracts={writeContracts}
                        ethPayHandler={ethPayHandler}
                        tokenPayHandler={tokenPayHandler}
                        nativeCurrency={nativeCurrency}
                        loadContracts={loadContracts}
                        loadedTokenList={loadedTokenList}
                        userSigner={userSigner}
                      />
                    ) : (
                      <Button
                        key="loginbutton"
                        style={{ marginTop: 20, width: "80%" }}
                        size="large"
                        onClick={loadWeb3Modal}
                        type="primary"
                        shape="round"
                      >
                        Connect Wallet to Distribute
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Tabs.TabPane>
            <Tabs.TabPane tab="Payouts" key="2">
              {/* Transactions */}
              <div style={{ marginBottom: 25, flex: 1 }}>
                <Card title={txHash.length > 0 ? "Payout Transactions" : ""} style={{ width: "100%" }}>
                  {txHash.length === 0 && (
                    <h2>
                      No payouts have been administered for this room {chainId ? "on " + NETWORK(chainId).name : ""}
                    </h2>
                  )}
                  {txHash.length > 0 && (
                    <>
                      <List
                        header={
                          <>
                            <div
                              style={{
                                flex: 1,
                                display: "flex",
                                width: "100%",
                                flexDirection: "row",
                                justifyContent: "space-between",
                                paddingLeft: 10,
                              }}
                            >
                              <div className="text-purple-textPurple text-sm">TxHash</div>
                              <div className="text-purple-textPurple text-sm">Distributor</div>
                              <div className="text-purple-textPurple text-sm">Status</div>
                            </div>
                            <Divider style={{ borderColor: "#6F3FF5", marginTop: "0", marginBottom: "0" }} />
                          </>
                        }
                        bordered
                        dataSource={txHash}
                        renderItem={(item, index) => (
                          <List.Item>
                            <div
                              style={{
                                width: "100%",
                              }}
                            >
                              <TransactionHash
                                localProvider={localProvider}
                                chainId={chainId}
                                hash={item}
                                fontSize={14}
                                mainnetProvider={mainnetProvider}
                              />
                            </div>
                          </List.Item>
                        )}
                      />
                    </>
                  )}
                </Card>
              </div>
            </Tabs.TabPane>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
