import React, { useEffect, useState, useRef } from "react";
import { Button, List, notification, Card, Collapse, Tabs, Menu, Dropdown } from "antd";
import { ExportOutlined } from "@ant-design/icons";
import { Address, TransactionHash } from "../components";
import { useParams } from "react-router-dom";
import { CSVLink } from "react-csv";
import copy from "copy-to-clipboard";
import { useTokenImport } from "../hooks";
import * as storage from "../utils/storage";

//import useWindowSize from 'react-use/lib/useWindowSize'
import Confetti from "react-confetti";
import "./GuestRoom.css";

export default function GuestRoom({
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
  toggleSwitch,
}) {
  const { room } = useParams();
  //const { width, height } = useWindowSize()

  const [spender, setSpender] = useState("");
  const [addresses, setAddresses] = useState([]);
  const [txHash, setTxHash] = useState([]);
  const [isSigning, setIsSigning] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [numberOfConfettiPieces, setNumberOfConfettiPieces] = useState(0);
  const [contracts, loadContracts, addContracts] = useTokenImport(localProvider, userSigner);

  const { readContracts, writeContracts } = contracts;

  const subs = useRef([]);

  useEffect(() => {
    if (oldWriteContracts?.TokenDistributor) {
      setSpender(oldWriteContracts?.TokenDistributor?.address);
      addContracts({ writeContracts: oldWriteContracts, readContracts: oldReadContracts });
    }
  }, [oldWriteContracts]);

  const handleConfetti = e => {
    setNumberOfConfettiPieces(200);
    setTimeout(() => {
      setNumberOfConfettiPieces(0);
    }, 4000);
  };

  const handleListUpdate = list => {
    const updatedList = new Set([...addresses, ...list]);
    // update addresses list
    setAddresses([...updatedList]);
  };

  const handleTransactionUpdate = newTx => {
    const update = new Set([...newTx, ...txHash]);
    setTxHash([...update]);
  };

  useEffect(() => {
    if (addresses.includes(address.toLowerCase())) {
      setIsSignedIn(true);
    }
  }, [addresses, address]);

  // useEffect(() => {
  //   const dist =  storage.getRoomDistributor(room);
  //   setDistributor(dist);
  //   console.log("Distributor: " + dist)
  // }, [room] );

  useEffect(() => {
    // clear existing subscriptions
    subs.current.map(sub => sub());

    // start new subscriptions
    if (chainId) {
      subs.current.push(storage.watchRoom(room, handleListUpdate));
      subs.current.push(storage.watchRoomTx(room, chainId, handleTransactionUpdate));
    }
  }, [room, chainId]);

  const handleSignIn = async () => {
    if (typeof appServer == "undefined") {
      return notification.error({
        message: "Setup Error",
        description: "Missing REACT_APP_SERVER environment variable in localhost environment",
        placement: "bottomRight",
      });
    }

    if (web3Modal.cachedProvider == "") {
      return notification.error({
        message: "Failed to Sign In!",
        description: "Please Connect a wallet before Signing in",
        placement: "bottomRight",
      });
    }

    const messageLength = room && room.split(" ").length;
    if (typeof room == "undefined" || room === "" || messageLength > 1) {
      return notification.error({
        message: "Failed to Sign In!",
        description: "Message should be one word",
        placement: "bottomRight",
      });
    }

    setIsSigning(true);

    // sign roomId using wallet
    let signature = await userSigner.signMessage(room);

    try {
      // sign into room
      await storage.signIntoRoom(room, signature);

      // notify user of signIn
      setIsSignedIn(true);

      notification.success({
        message: "Signed in successfully",
        placement: "bottomRight",
      });
      handleConfetti();
      setAddresses([...addresses, address]);
    } catch (error) {
      setIsSigning(false);

      return notification.error({
        message: "Failed to Sign!",
        description: `Connection issue ${error}`,
        placement: "bottomRight",
      });
    }

    setIsSigning(false);
  };

  const copyToClipBoard = () => {
    copy(addresses, {
      debug: true,
      message: "Copied List to ClipBoard",
    });
    notification.success({
      message: "Copied List To ClipBoard",
      placement: "bottomRight",
    });
  };

  const exportMenu = (
    <Menu>
      <Menu.Item key="export_csv">
        <CSVLink data={addresses.toString()} filename={`tip-party-addresses-${Date.now()}.csv`}>
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
    <div>
      <div>
        <h2 id="title">Welcome to the Tip Party!</h2>

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
          <Confetti recycle={true} run={true} numberOfPieces={numberOfConfettiPieces} tweenDuration={3000} />
          {toggleSwitch}

          <div style={{ marginTop: "10px", marginBottom: "10px" }}>
            <Tabs defaultActiveKey="1" centered>
              <Tabs.TabPane tab="Room" key="1">
                <div style={{ marginTop: 10 }}>
                  {/* <div style={{ marginBottom: 20 }}>
                <h2>Sign In</h2>
              </div> */}
                  <div style={{ marginBottom: 20 }}>
                    <Button
                      type="primary"
                      shape="round"
                      onClick={handleSignIn}
                      disabled={isSignedIn}
                      loading={isSigning}
                    >
                      Sign Into "{room}" Room
                    </Button>
                  </div>
                  {/* <Divider /> */}

                  <div style={{ flex: 1 }}>
                    <Collapse defaultActiveKey={["1"]}>
                      <Collapse.Panel
                        header={`Signed In - ${addresses.length}`}
                        key="1"
                        extra={
                          <div onClick={e => e.stopPropagation()}>
                            <Dropdown overlay={exportMenu} placement="bottomRight" arrow trigger="click">
                              <ExportOutlined />
                            </Dropdown>
                          </div>
                        }
                      >
                        <List
                          bordered
                          dataSource={addresses}
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
                                <Address address={item} ensProvider={mainnetProvider} fontSize={14} />
                              </div>
                            </List.Item>
                          )}
                        />
                      </Collapse.Panel>
                    </Collapse>
                  </div>
                </div>
              </Tabs.TabPane>
              <Tabs.TabPane tab="Payouts" key="2">
                {/* Transactions */}
                <div style={{ marginBottom: 25, flex: 1 }}>
                  <Card title="Payout Transactions" style={{ width: "100%" }}>
                    <List
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
                            />
                          </div>
                        </List.Item>
                      )}
                    />
                  </Card>
                </div>
              </Tabs.TabPane>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
