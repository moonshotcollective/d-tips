import React from "react";
import { HostRoom, GuestRoom } from ".";

export default function Rooms({
  appServer,
  web3Modal,
  address,
  userSigner,
  mainnetProvider,
  writeContracts,
  readContracts,
  yourLocalBalance,
  localProvider,
  chainId,
  selectedChainId,
  tx,
  nativeCurrency,
  isHost,
  networkTokenList,
  isWalletConnected,
  loadWeb3Modal,
  twitterName,
}) {
  return (
    <div>
      <div>
        {isHost && (
          <HostRoom
            address={address}
            appServer={appServer}
            web3Modal={web3Modal}
            userSigner={userSigner}
            mainnetProvider={mainnetProvider}
            readContracts={readContracts}
            writeContracts={writeContracts}
            localProvider={localProvider}
            yourLocalBalance={yourLocalBalance}
            chainId={chainId}
            selectedChainId={selectedChainId}
            tx={tx}
            nativeCurrency={nativeCurrency}
            networkTokenList={networkTokenList}
            isWalletConnected={isWalletConnected}
            loadWeb3Modal={loadWeb3Modal}
            twitterName={twitterName}
          />
        )}
      </div>
      {!isHost && (
        <div>
          <GuestRoom
            address={address}
            appServer={appServer}
            web3Modal={web3Modal}
            userSigner={userSigner}
            mainnetProvider={mainnetProvider}
            readContracts={readContracts}
            writeContracts={writeContracts}
            localProvider={localProvider}
            yourLocalBalance={yourLocalBalance}
            chainId={chainId}
            selectedChainId={selectedChainId}
            tx={tx}
            nativeCurrency={nativeCurrency}
            isWalletConnected={isWalletConnected}
            loadWeb3Modal={loadWeb3Modal}
            twitterName={twitterName}
          />
        </div>
      )}
    </div>
  );
}
